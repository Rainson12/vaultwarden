import { test, expect, type TestInfo } from '@playwright/test';

import * as utils from "../global-utils";
import { logNewUser, logUser } from './setups/sso';

let users = utils.loadEnv();

let mailserver, user1Mails, user2Mails;

test.beforeAll('Setup', async ({ browser }, testInfo: TestInfo) => {
    mailserver = new MailDev({
        port: process.env.MAILDEV_SMTP_PORT,
        web: { port: process.env.MAILDEV_HTTP_PORT },
    })

    await mailserver.listen();

    await utils.startVaultwarden(browser, testInfo, {
        SSO_ENABLED: true,
        SSO_ONLY: true,
        SSO_ORGANIZATIONS_INVITE: true,
        SMTP_HOST: process.env.MAILDEV_HOST,
        SMTP_FROM: process.env.VAULTWARDEN_SMTP_FROM,
    });

    user1Mails = mailserver.iterator(users.user1.email);
    user2Mails = mailserver.iterator(users.user2.email);
});

test.afterAll('Teardown', async ({}) => {
    utils.stopVaultwarden();
    utils.closeMails(mailserver, [user1Mails, user2Mails]);
});

test('Log user1 and create Test Org', async ({ page }) => {
    await logNewUser(test, page, users.user1, { emails: user1Mails });

    await test.step('Create Org', async () => {
        await page.getByRole('link', { name: 'New organization' }).click();
        await page.getByLabel('Organization name (required)').fill('Test');
        await page.getByRole('button', { name: 'Submit' }).click();
        await page.locator('div').filter({ hasText: 'Members' }).nth(2).click();
    });
});

test('Log with user2 and receive invite', async ({ page }) => {
    await logNewUser(test, page, users.user2, { emails: user2Mails });

    const { value: invited } = await user2Mails.next();
    expect(invited.subject).toContain("Join Test")
});
