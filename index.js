import puppeteer from "puppeteer-core"
import { updateInsurance, updateVisa } from "./update.js";
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

  // const browser = await puppeteer.launch()
 try {
  console.log('step-1');
  await updateVisa(browser, visaId, applicationNo)
  await browser.close()
  console.log('Browser closed.');

 } catch (error) {
  console.log(error);
  await browser.close()
  throw new Error('failed')
}
}
async function automateInsurance(passportNo, applicationNo) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  // const browser = await puppeteer.launch()
 try {
  console.log('step-1');
  let status = await updateInsurance(browser, passportNo, applicationNo)
  await browser.close()
  console.log('Browser closed.', '----line:44');
return {status}
 } catch (error) {
  console.log(error);
  await browser.close()
  throw new Error('failed')
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

  const now = new Date();
const formattedDateTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
console.log("Current date and time:", formattedDateTime);

  console.log(new Date())
    const { visaId, applicationNo } = await c.req.json()
    
await automate(visaId, applicationNo)
  return c.json({
    data: {visaId, applicationNo},
    status: 'done'
  })

})
app.post('/insurance', async (c) =>{
try {
  
  const now = new Date();
const formattedDateTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
console.log("Current date and time:", formattedDateTime);

  console.log(new Date())
    const { passportNo, applicationNo } = await c.req.json()
    
   let res = await automateInsurance(passportNo, applicationNo)
console.log(res);
 c.status(200)
  return c.json({
    data: {passportNo, applicationNo},
    status: 'done'
  })

} catch (error) {
  c.status(500)
  return c.json({
    mesaage: 'Something went wrong',
  })
}

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
