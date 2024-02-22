import puppeteer, { Browser, Page } from "puppeteer"
import { updateVisa } from "./update.js";
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { config } from "dotenv";
config();

async function automate(visaId, applicationNo) {
  console.log('step-1');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  console.log('step-2');
  return await updateVisa(browser, visaId, applicationNo)
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
    const { visaId, applicationNo } = await c.req.json()
    
await automate(visaId, applicationNo)
  return c.json({
    data: {visaId, applicationNo},
    status: 'done'
  })

})

serve({
  fetch: app.fetch,
  port: process.env.PORT
}, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})
