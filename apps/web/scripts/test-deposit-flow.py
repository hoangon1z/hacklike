"""Browser regression tests. All /api calls are mocked; never credits a live wallet.
Run in the existing Selenium/Chromium container with DEPOSIT_TEST_URL pointing to a preview.
"""
import os,time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
url=os.environ.get('DEPOSIT_TEST_URL','http://deposit-preview')
options=webdriver.ChromeOptions()
for arg in ['--headless','--no-sandbox','--disable-dev-shm-usage','--window-size=1440,1000','--unsafely-treat-insecure-origin-as-secure='+url]: options.add_argument(arg)
options.binary_location='/usr/bin/chromium'
d=webdriver.Chrome(service=Service('/app/chromedriver'),options=options)
mock=r'''const scenario=new URL(location.href).searchParams.get('case')||'success';
if(sessionStorage.getItem('scenario')!==scenario){localStorage.clear();sessionStorage.clear();sessionStorage.setItem('scenario',scenario);}
window.mock=JSON.parse(sessionStorage.getItem('mock')||'{"rows":[],"posts":0,"me":0,"popups":0}');
window.save=()=>sessionStorage.setItem('mock',JSON.stringify(window.mock));
window.networkDown=false;
window.fetch=async(url,opts={})=>{
 const p=String(url);let data;
 if(p.includes('/auth/me')){window.mock.me++;data={id:'test-'+scenario,displayName:'Test',email:'test@example.invalid',role:'CUSTOMER',status:'ACTIVE',wallet:{balance:String(window.mock.rows.reduce((sum,r)=>sum+Number(r.creditedVnd||0),0)),reserved:'0'}};}
 else if(p.includes('/health/capabilities'))data={banking:true,usdt:true,usdtTrc20:true,bankAccounts:[{id:'bank',bankName:'MBBank',last4:'0000'}]};
 else if(p.includes('/payments/deposits')){
  if(opts.method==='POST'){
   window.mock.posts++;const b=JSON.parse(opts.body);
   data={publicId:'DEP-'+window.mock.posts,method:b.method,status:'WAITING',requestedVnd:String(b.amountVnd),creditedVnd:null,paymentCode:'SVN1234567890',expectedUsdt:'4.123456',network:b.method==='BANKING'?null:'TRX',destinationAddress:'TTestAddress',expiresAt:new Date(Date.now()+1800000).toISOString(),banking:b.method==='BANKING'?{id:'bank',bankName:'MBBank',accountNumber:'0000',accountName:'TEST'}:null};
   window.mock.rows.unshift(data);
  }else{if(window.networkDown)throw new TypeError('Network unavailable');data=window.mock.rows;}
 }else data=[];
 window.save();return new Response(JSON.stringify({success:true,data}),{status:200,headers:{'Content-Type':'application/json'}});
};
new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'&&record.target.matches('dialog[open]')){window.mock.popups++;window.save();}}}).observe(document,{subtree:true,attributes:true,attributeFilter:['open']});
'''
d.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument',{'source':mock})
def wait(fn,seconds=12):return WebDriverWait(d,seconds).until(lambda _:fn())
def js(script):return d.execute_script(script)
def opened():return d.find_elements(By.CSS_SELECTOR,'dialog[open]')
def start(case):
 d.get(url+'/deposit?case='+case)
 wait(lambda:js('return window.mock?.posts')==1)
 wait(lambda:len(d.find_elements(By.CSS_SELECTOR,'.payment-instruction'))==1)
 assert not opened(),'Creating a deposit must never notify success'
def status(value,credit=None):
 d.execute_script("window.mock.rows[0].status=arguments[0];window.mock.rows[0].creditedVnd=arguments[1];window.save();",value,credit)
def text():return d.find_element(By.TAG_NAME,'body').text.replace('\u00a0',' ')
try:
 start('success');before=js('return window.mock.me');status('COMPLETED','100000')
 wait(lambda:bool(opened()));assert 'Nạp tiền thành công' in opened()[0].text
 assert 'Số tiền: 100.000 ₫' in opened()[0].text.replace('\u00a0',' ')
 wait(lambda:js('return window.mock.me')>before)
 assert '100.000 ₫' in d.find_element(By.CSS_SELECTOR,'.wallet-chip').text.replace('\u00a0',' ')
 assert 'Nạp tiền thành công' in d.find_element(By.CSS_SELECTOR,'.deposit-history').text
 wait(lambda:not opened(),7);time.sleep(4.2);assert js('return window.mock.popups')==1
 d.refresh();time.sleep(4.5);assert not opened();assert js('return window.mock.popups')==1
 print('PASS success, balance/history refresh, 4s auto-close, repeated success and page reload dedup',flush=True)
 start('resume');status('CONFIRMING');time.sleep(4.2);assert 'Đang xử lý...' in text()
 posts=js('return window.mock.posts');d.refresh();wait(lambda:bool(d.find_elements(By.CSS_SELECTOR,'.payment-instruction')))
 assert js('return window.mock.posts')==posts;assert not opened()
 status('COMPLETED','100000');d.refresh();wait(lambda:bool(opened()));assert 'Nạp tiền thành công' in opened()[0].text
 d.set_window_size(390,844);assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth');d.set_window_size(1440,1000)
 print('PASS pending reload, completion while away restored once, mobile containment',flush=True)
 for scenario,remote,title in [('failure','REJECTED','Nạp tiền không thành công'),('cancel','CANCELED','Giao dịch đã bị hủy')]:
  start(scenario);status(remote);wait(lambda:bool(opened()));assert title in opened()[0].text
  print('PASS '+scenario,flush=True)
 start('network');js('window.networkDown=true');wait(lambda:'Không thể kiểm tra trạng thái giao dịch. Vui lòng thử lại.' in text())
 assert not opened();assert js('return window.mock.rows[0].status')=='WAITING'
 js('window.networkDown=false');status('COMPLETED','100000');wait(lambda:bool(opened()))
 print('PASS network failure preserves pending; recovers to confirmed success',flush=True)
 start('double');button=next(x for x in d.find_elements(By.TAG_NAME,'button') if x.text=='USDT TRC20');button.click()
 wait(lambda:any(x.text=='Tạo yêu cầu nạp' and x.is_enabled() for x in d.find_elements(By.TAG_NAME,'button')))
 js("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='Tạo yêu cầu nạp');b.click();b.click();")
 wait(lambda:js('return window.mock.posts')==2);time.sleep(1)
 assert js('return window.mock.posts')==2
 assert next(x for x in d.find_elements(By.TAG_NAME,'button') if x.text=='Tạo yêu cầu nạp').get_attribute('disabled')
 assert not opened();status('COMPLETED','100000');wait(lambda:bool(opened()))
 print('PASS USDT double click creates once, creation is not success; confirmed USDT succeeds',flush=True)
 start('invalid-success');status('COMPLETED',None);time.sleep(4.5);assert not opened()
 status('UNDERPAID','30000');time.sleep(4.5);assert not opened();assert '30.000 ₫' in text()
 status('OVERPAID','100000');wait(lambda:bool(opened()));assert 'Phần chuyển dư' in opened()[0].text
 print('PASS malformed success rejected, partial credit no success, OVERPAID reports credited amount',flush=True)
finally:d.quit()
