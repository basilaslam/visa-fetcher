import puppeteer from "puppeteer-core"
import { updateVisa } from "./update.js";
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import chromium from "@sparticuz/chromium";
import { config } from "dotenv";
config();


async function automate(visaId, applicationNo) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
 try {
  console.log('step-1');
  await updateVisa(browser, visaId, applicationNo)
  await browser.close()
  console.log('Browser closed.');

 } catch (error) {
  await browser.close()
  console.log('Browser closed.');

}
}



// async function automate(visaId, applicationNo) {
//   console.log("step-1")
  
//   const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  
// /** @type {Page} */
//   const page = await browser.newPage();
//   await page.goto('https://www.google.com')
//   await page.addStyleTag({ path: './font.css' });
//   await page.pdf({
//     path: './public/test.pdf',
//     format: "A4"
//   })
//   await page.close()
//   console.log("step-2")
// }




const app = new Hono()


app.post('/', async (c) =>{
  console.log(await chromium.executablePath());
    const { visaId, applicationNo } = await c.req.json()
    
await automate(visaId, applicationNo)
  return c.json({
    data: {visaId, applicationNo},
    status: 'done'
  })

})


app.get('/', async (c) =>{
 
  
return c.text('this is visa fetcher')

})

serve({
  fetch: app.fetch,
  port: process.env.PORT
}, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})
