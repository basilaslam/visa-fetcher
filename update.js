import axios from "axios";
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';
import path, { basename } from 'path';
import { config } from "dotenv";
import FormData from "form-data";
import { Page } from "puppeteer-core";
import {fromBase64} from "pdf2pic"
config();

/**
 * Logs in to the given page using the provided credentials and captcha.
 * @param { Page } page The page to log in to.
 * @returns A Promise that resolves when the login is successful, or rejects with an error if it fails.
 */
const login = async (page, fileName, tmpFilePath, retries = 3) => {
    try {
        await page.goto('https://princessbooking.com/?_=100&s=up.login');
    } catch (error) {
        console.error('Navigation failed:', error);
        throw new Error('navigation error')
    }
    const userId = process.env.METT_USERNAME;
    const password = process.env.METT_PASSWORD;
    await screenShotCaptcha(page, tmpFilePath);
    let captchaText = await getCaptcha(fileName, tmpFilePath);
    console.log(captchaText);
    while (captchaText.length !== 3 || !RegExp("^[0-9]*$").test(captchaText)) {
        console.log("retrying...");
        await page.reload({ waitUntil: "networkidle0" });
        await screenShotCaptcha(page, tmpFilePath);
        captchaText = await getCaptcha(fileName, tmpFilePath);
    }
    console.log("Captcha got successfully");
    while (retries > 0) {
        try {
            console.log(userId, password, 'cred');
            if(!page.url().includes('login')){
              return
            }
            const userNameInput = await page.waitForSelector("input[type=email]");
            const passwordInput = await page.waitForSelector("input[type=password]");
            // Clear input fields before typing
            await page.evaluate(() => {
                document.querySelector("input[type=email]")?.setAttribute("value", "");
                document.querySelector("input[type=password]")?.setAttribute("value", "");
                document.querySelector(".captcha > input:nth-child(3)")?.setAttribute("value", "");
            });
            await userNameInput?.type(userId);
            await passwordInput?.type(password);
            await page.type(".captcha > input:nth-child(3)", captchaText);
            const checkBox = await page.waitForSelector('.H > input:nth-child(1)');
            await checkBox?.click();
            const button = await page.waitForSelector("button[type=submit]");
            await button?.click();
            await page.waitForNavigation();
            const url = page.url();
            if (url.includes("login")) {
                throw new Error("Login failed");
            }
            console.log("Login successful");
            return;
        } catch (error) {
          if(retries < 1){
            return new Error('retries expired')
          }
          console.log(`Login failed. Retries left: ${retries}`);
          console.log('eoor from 2');
          retries--;
          await page.reload()
          await login(page, fileName, tmpFilePath);  // Decrement retries when making a recursive call
        }
    }
    throw new Error("Maximum retries exceeded");
};

const removeFile = (filePath) => {
    try {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} removed successfully`);
    } catch (error) {
      console.error(`Error removing file ${filePath}:`, error);
    }
};

const screenShotCaptcha = async (page, filePath) => {
    const captcha = await page.waitForSelector(
      ".captcha > b:nth-child(2) > img:nth-child(1)"
    );
    try {
      if (captcha) {
        await captcha.screenshot({ path: filePath });
      }
    } catch (error) {
      console.log("error in screenshot", error);
    }
    console.log("captured.......");
};

async function uploadVisa(visaId, applicationNo){
    let url = process.env.UPLOAD_VISA_API;
    await axios.post(url,{
        visaId,
        applicationNo
    })
}

const getCaptcha = async (fileName, filePath) => {
    const url = "https://captcha-cpeitwtrka-uc.a.run.app";
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append("myFile", fileStream, fileName);
    try {
      const captcha = await axios.post(url, form);
      const output = cleanCaptcha(captcha.data.captcha);
      console.log(output);
      return output;
    } catch (error) {
      console.log(error);
    }
};

function cleanCaptcha(captcha) {
    // Use regular expression to remove non-digit characters
    if (captcha) {
      const cleanedCaptcha = captcha.replace(/[^\d]/g, "");
      return cleanedCaptcha;
    }
    return "";
}

const getVisa = async (browser, page, visaId, pdfOutPath) => {


    const url = `https://princessbooking.com/?_=403&s=vs.voucher&id=${visaId}`
    await page.goto(url)
    await page.evaluate(() => {
      const row1 = document.querySelector('body > main > table > tbody > tr:nth-child(6) > td > table > tbody > tr:nth-child(14)');
      const row2 = document.querySelector('body > main > table > tbody > tr:nth-child(6) > td > table > tbody > tr:nth-child(15)');
      const row3 = document.querySelector('body > main > table > tbody > tr:nth-child(6) > td > table > tbody > tr:nth-child(16)');
      if (row1) row1.innerHTML = '';
      if (row2) row2.innerHTML = '';
      if (row3) row3.innerHTML = '';
    });
    const visaContent = await page.$eval('body > main > table', content => content.outerHTML)
    const page2 = await browser.newPage()
    await page2.setContent(visaContent)
    await page2.pdf({ path: pdfOutPath, format: 'A4' })

    await page2.close()
}


async function convertPdfToTiffAndSave(pdf, pdfOutPath) {

  try {
    const fileName = path.basename(pdfOutPath);
    const options = {
      density: 600,
      saveFilename: fileName,
      savePath: "./tmp",
      format: "jpeg",
      width: 2480,
      height: 3508,
    };
    const convert = fromBase64(pdf, options);  
    const pageToConvertAsImage = 1 
    let fileData = await convert(pageToConvertAsImage, { responseType: "image" })
     
     console.log('insurance saved succesfully', '  ', fileData.name);
  } catch (error) {
    console.log(error, 'is this it');
  }
}


const getInsurance = async (page, visaId, pdfOutPath, browser) => {    
   try {
     console.log('test-1');
    const client = await page.createCDPSession();

    await client.send('Fetch.enable', {
      patterns: [
        {
          urlPattern: '*',
          requestStage: 'Response',
        },
      ],
    });
  
    await client.on('Fetch.requestPaused', async (reqEvent) => {
      const { requestId } = reqEvent;
  
      let responseHeaders = reqEvent.responseHeaders || [];
      let contentType = '';
  
      for (let elements of responseHeaders) {
        if (elements.name.toLowerCase() === 'content-type') {
          contentType = elements.value;
        }
      }
  
      if (contentType.endsWith('pdf')) {
  
        responseHeaders.push({
          name: 'content-disposition',
          value: 'attachment',
        });
  
        const responseObj = await client.send('Fetch.getResponseBody', {
          requestId,
        });
        console.log('converting');
        await convertPdfToTiffAndSave(responseObj.body, pdfOutPath)
        console.log('converted');
  
        await client.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders,
          body: responseObj.body,
        });
      } else {
        await client.send('Fetch.continueRequest', { requestId });
      }
    });
      const url = `https://princessbooking.com/?_=403&s=vs.insurance&vs=${visaId}&_p_st=-2`
      await page.goto(url)
      await page.close()
   } catch (error) {
    console.log(error);
  await page.close() 
  }
}

const loginToServer = async () => {
  try {
    const res = await axios.post(`${process.env.API}/api/v1/auth/login`,{
      email: process.env.PORTAL_EMAIL,
      password: process.env.PORTAL_PASSWORD
   })
   const accessToken = res.data.accessToken
   return accessToken
  } catch (error) {
    console.log(error);
    throw new Error('Server Login Error')
  }
}

const sendVisa = async(filePath, applicationNo, accessToken) => {
    try {
    const form = new FormData()
    form.append('visa', fs.createReadStream(filePath))
    form.append('source','automation')
    const savedRes =  await axios.patch(`${process.env.API}/api/v1/admin/form/update/${applicationNo}`, form, {
      headers: {
        'Content-Type': "multipart/form-data",
        "Authorization": `Bearer ${accessToken}`
      }
    })
    console.log(filePath);
    return 'done'
    } catch (error) {
     console.log(error);
    }
}
const sendInsurance = async(filePath, applicationNo, accessToken) => {
    try {
    const form = new FormData()
    form.append('insurance', fs.createReadStream(filePath))
    form.append('source','automation')
    const savedRes =  await axios.patch(`${process.env.API}/api/v1/admin/form/update/${applicationNo}`, form, {
      headers: {
        'Content-Type': "multipart/form-data",
        "Authorization": `Bearer ${accessToken}`
      }
    })
    console.log(filePath);
    return 'done'
    } catch (error) {
     console.log(error);
    }
}

export const updateVisa = async (browser, visaId, applicationNo) => {
  console.log('Starting updateVisa process...');
  const url = `https://princessbooking.com/?_=403&s=vs.voucher&id=${visaId}`;
  /**
 * @type {Page}
 */
  const page = await browser.newPage();
  console.log('Navigating to visa page...');
  await page.goto(url);

  const fileName = `${randomUUID()}--captcha.png`;
  const tmpFilePath = path.join('./tmp', fileName);
  const visaPdfFileName = `${randomUUID()}--visa.pdf`;
  const visaPdfOutPath = path.join('./tmp', visaPdfFileName);
  const insurancePdfFileName = `${randomUUID()}--insurance`;
  const insurancePdfOutPath = path.join('./tmp', insurancePdfFileName);

  console.log('Logging in to the server...');
  const accessToken = await loginToServer();
  
  
  await login(page, fileName, tmpFilePath);
  
  console.log('Logging in to Princess...');
  while(page.url().includes('login')){
    await login(page, fileName, tmpFilePath);
  }
  console.log('Login successful.');

  removeFile(tmpFilePath);
  console.log('Removed temporary captcha file.');

  console.log('Fetching visa details...');
  await getVisa(browser, page, visaId, visaPdfOutPath);
  console.log('Visa details fetched and saved as PDF.');

  console.log('Fetching insurance details...');
  await getInsurance(page, visaId, insurancePdfOutPath, browser);
  console.log('Insurance details fetched and saved as PDF.');

  console.log('Sending visa and insurance documents to server...');
  const visaRes = await sendVisa(visaPdfOutPath, applicationNo, accessToken);
  const insuranceRes = await sendInsurance(`${insurancePdfOutPath}.1.jpeg`, applicationNo, accessToken);
  console.log('Visa and insurance documents sent successfully.');

  removeFile(visaPdfOutPath);
  removeFile(`${insurancePdfOutPath}.1.jpeg`);
  console.log('Removed temporary PDF files.');
  console.log('updateVisa process completed.');
  return {
    status: "done"
  };
};
export const updateInsurance = async (browser, visaId, applicationNo) => {
  console.log('Starting updateVisa process...');
  const url = `https://princessbooking.com/?_=403&s=vs.voucher&id=${visaId}`;
  /**
 * @type {Page}
 */
  const page = await browser.newPage();
  console.log('Navigating to visa page...');
  await page.goto(url);

  const fileName = `${randomUUID()}--captcha.png`;
  const tmpFilePath = path.join('./tmp', fileName);
  const insurancePdfFileName = `${randomUUID()}--insurance`;
  const insurancePdfOutPath = path.join('./tmp', insurancePdfFileName);

  console.log('Logging in to the server...');
  const accessToken = await loginToServer();
  
  
  await login(page, fileName, tmpFilePath);
  
  console.log('Logging in to Princess...');
  while(page.url().includes('login')){
    await login(page, fileName, tmpFilePath);
  }
  console.log('Login successful.');

  removeFile(tmpFilePath);
  console.log('Removed temporary captcha file.');

  console.log('Fetching insurance details...');
  await getInsurance(page, visaId, insurancePdfOutPath, browser);
  console.log('Insurance details fetched and saved as PDF.');

  console.log('Sending insurance documents to server...');
  const insuranceRes = await sendInsurance(`${insurancePdfOutPath}.1.jpeg`, applicationNo, accessToken);
  console.log('Insurance documents sent successfully.');

  removeFile(`${insurancePdfOutPath}.1.jpeg`);
  console.log('Removed temporary PDF files.');
  console.log('updateInsurance process completed.');
  return {
    status: "done"
  };
};


