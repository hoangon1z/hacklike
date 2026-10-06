import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer,loadEnv} from 'vite';
import {renderToString} from 'react-dom/server';
import {createElement} from 'react';

const root=process.cwd();
const env={...loadEnv('production',resolve(root,'../..'),''),...loadEnv('production',root,'')};
const configured=(process.env.PUBLIC_SITE_URL||env.PUBLIC_SITE_URL||'').trim();
let origin='';
if(configured){const parsed=new URL(configured);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('PUBLIC_SITE_URL must be a public site origin, e.g. https://your-domain.vn');origin=parsed.origin;}
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
try{
 const {LandingPage,landingTitle,landingDescription}=await server.ssrLoadModule('/src/LandingPage.tsx');
 const file=resolve(root,'dist/index.html');
 const template=await readFile(file,'utf8');
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
 const schema={'@context':'https://schema.org','@type':'WebSite',name:'Hacklike43',description:landingDescription,inLanguage:'vi-VN',...(origin?{url:`${origin}/`}:{})};
 const metadata=`<meta name="robots" content="${origin?'index, follow':'noindex, nofollow'}"><meta name="theme-color" content="#fcfaf7"><meta property="og:type" content="website"><meta property="og:locale" content="vi_VN"><meta property="og:site_name" content="Hacklike43"><meta property="og:title" content="${escape(landingTitle)}"><meta property="og:description" content="${escape(landingDescription)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(landingTitle)}"><meta name="twitter:description" content="${escape(landingDescription)}">${origin?`<link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/">`:''}<script type="application/ld+json">${json(schema)}</script>`;
 const base=template.replace(/<title>.*?<\/title>/,'<title>'+escape(landingTitle)+'</title>').replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(landingDescription)}">`);
 await writeFile(file,base.replace('</head>',metadata+'</head>').replace('<div id="root"></div>',`<div id="root">${renderToString(createElement(LandingPage))}</div>`));
 await writeFile(resolve(root,'dist/app.html'),template.replace('</head>','<meta name="robots" content="noindex, nofollow"></head>'));
 await writeFile(resolve(root,'dist/robots.txt'),origin?`User-agent: *\nAllow: /$\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /login\nDisallow: /register\nDisallow: /api/\nDisallow: /order\nDisallow: /deposit\nDisallow: /profile\nDisallow: /notifications\nDisallow: /schedule\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
 await writeFile(resolve(root,'dist/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin?`<url><loc>${escape(origin)}/</loc></url>`:''}</urlset>`);
 console.log(`Landing pre-rendered. ${origin?'Canonical and sitemap configured.':'Set PUBLIC_SITE_URL before public deployment; indexing is currently disabled.'}`);
}finally{await server.close();}
