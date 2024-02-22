import axios from "axios";
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { config } from "dotenv";
import FormData from "form-data";

config();

/**
 * Logs in to the given page using the provided credentials and captcha.
 * @param page The page to log in to.
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
            await login(page, fileName, tmpFilePath);  // Decrement retries when making a recursive call
            console.log(`Login failed. Retries left: ${retries}`);
            console.log('eoor from 2');
            retries--;
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
    console.log('does it work');
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
    await page.close()
    await browser.close()
}

const sendFile = async(filePath, applicationNo) => {
    try {
    const res = await axios.post(`${process.env.API}/api/v1/auth/login`,{
       email: process.env.PORTAL_EMAIL,
       password: process.env.PORTAL_PASSWORD
    })
    const accessToken = res.data.accessToken
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

export const updateVisa = async (browser, visaId, applicationNo) => {
    const url = `https://princessbooking.com/?_=403&s=vs.voucher&id=${visaId}`
    const page = await browser.newPage()
    await page.goto(url)
    console.log('step-3');
    const fileName = `${randomUUID()}--captcha.png`;
    const tmpFilePath = path.join('./tmp', fileName);
    const pdfFileName = `${randomUUID()}--visa.pdf`;
    const pdfOutPath = path.join('./tmp', pdfFileName)
    await login(page, fileName, tmpFilePath);
    console.log('step-4');
    await removeFile(tmpFilePath);
    console.log('step-4.2');
    await getVisa(browser, page, visaId, pdfOutPath)
    console.log('step-5');
    const res = await sendFile(pdfOutPath, applicationNo)
    await removeFile(pdfOutPath);
    return res
}

