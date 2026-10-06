import { Injectable } from '@nestjs/common';
import { Prisma, ServicePricingMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderService } from '../provider/provider.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService, private readonly provider: ProviderService) {}
  async publicList() {
    return this.prisma.service.findMany({ where: { adminEnabled: true, providerEnabled: true, systemEnabled: true, category: { enabled: true } }, include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] });
  }
  calculateSellingRate(rate: Prisma.Decimal, mode: ServicePricingMode, markup: Prisma.Decimal) {
    if (mode === 'FIXED_PRICE') return markup;
    if (mode === 'FIXED_MARKUP') return rate.add(markup);
    return rate.mul(new Prisma.Decimal(1).add(markup.div(100)));
  }
  isSellingRateSafe(providerRate: Prisma.Decimal, sellingRate: Prisma.Decimal, minimumMarginPercent: Prisma.Decimal) {
    return sellingRate.gte(providerRate.mul(new Prisma.Decimal(1).add(minimumMarginPercent.div(100))));
  }
  private providerBoolean(value:boolean|number|string){return value===true||value===1||String(value).toLowerCase()==='true'||String(value)==='1'}
  async syncFromProvider() {
    const remote = await this.provider.services();
    const defaults=await this.prisma.systemSetting.findMany({where:{key:{in:['DEFAULT_MARKUP_PERCENT','MINIMUM_SAFE_MARGIN_PERCENT','PROVIDER_RATE_MULTIPLIER']}}});
    const configured=Object.fromEntries(defaults.map(row=>[row.key,Number(row.value)]));
    const defaultMarkup=new Prisma.Decimal(Number.isFinite(configured.DEFAULT_MARKUP_PERCENT)?configured.DEFAULT_MARKUP_PERCENT:20);
    const defaultMinimumMargin=new Prisma.Decimal(Number.isFinite(configured.MINIMUM_SAFE_MARGIN_PERCENT)?configured.MINIMUM_SAFE_MARGIN_PERCENT:2);
    // SUBVIETNAM returns its USD-denominated rate per 1,000 units. The public
    // price list applies the documented 25,000 VND exchange rate.
    const providerRateMultiplier=new Prisma.Decimal(Number.isFinite(configured.PROVIDER_RATE_MULTIPLIER)?configured.PROVIDER_RATE_MULTIPLIER:25000);
    let changed = 0;
    await this.prisma.$transaction(async tx => {
      const seen: string[] = [];
      for (const item of remote) {
        const providerServiceId = String(item.service); seen.push(providerServiceId);
        const slug = item.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const category = await tx.serviceCategory.upsert({ where: { slug }, create: { slug, name: item.category }, update: { name: item.category } });
        const existing = await tx.service.findUnique({ where: { providerServiceId } });
        const newRate = new Prisma.Decimal(item.rate).mul(providerRateMultiplier);const refill=this.providerBoolean(item.refill);
        const inputMetadata = { providerType: item.type ?? 'Default', providerDescription: typeof item.desc === 'string' ? item.desc : null };
        if (!existing) {
          await tx.service.create({ data: { ...inputMetadata, providerServiceId, categoryId: category.id, providerName: item.name, displayName: item.name, providerRate: newRate, sellingRate: newRate.mul(new Prisma.Decimal(1).add(defaultMarkup.div(100))), markupValue:defaultMarkup, minimumSafeMargin:defaultMinimumMargin, min: Number(item.min), max: Number(item.max), refill, adminEnabled: false } });
          changed++; continue;
        }
        const sellingRate = this.calculateSellingRate(newRate, existing.pricingMode, existing.markupValue);
        const increasePercent = existing.providerRate.isZero() ? new Prisma.Decimal(0) : newRate.sub(existing.providerRate).div(existing.providerRate).mul(100);
        const systemEnabled = increasePercent.gt(20) ? false : this.isSellingRateSafe(newRate,sellingRate,existing.minimumSafeMargin);
        if (!existing.providerRate.equals(newRate)) {
          await tx.servicePriceHistory.create({ data: { serviceId: existing.id, oldProviderRate: existing.providerRate, newProviderRate: newRate, oldSellingRate: existing.sellingRate, newSellingRate: sellingRate, source: 'PROVIDER_SYNC' } }); changed++;
        }
        await tx.service.update({ where: { id: existing.id }, data: { ...inputMetadata, categoryId: category.id, providerName: item.name, previousProviderRate: existing.providerRate, providerRate: newRate, sellingRate, min: Number(item.min), max: Number(item.max), refill, providerEnabled: true, systemEnabled } });
      }
      await tx.service.updateMany({ where: { providerServiceId: { notIn: seen } }, data: { providerEnabled: false } });
    });
    return { total: remote.length, changed };
  }
}
