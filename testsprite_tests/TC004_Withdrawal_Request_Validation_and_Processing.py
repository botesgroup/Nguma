import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:8080", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Click on 'Commencer maintenant' to start login or registration process.
        frame = context.pages[-1]
        # Click on 'Commencer maintenant' button to start login or registration process
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input email and password, then click 'Se connecter' to login.
        frame = context.pages[-1]
        # Input email for login
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('manassembemba2003@gmail.com')
        

        frame = context.pages[-1]
        # Input password for login
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('2003Manasse')
        

        frame = context.pages[-1]
        # Click 'Se connecter' button to submit login form
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Navigate to 'Retraits en attente' or relevant section to manage withdrawal requests.
        frame = context.pages[-1]
        # Click on 'Retraits en attente' to view pending withdrawal requests and manage them
        elem = frame.locator('xpath=html/body/div/div[2]/div/div/div[2]/div/div[2]/div[2]/div[2]/ul/li[3]/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Navigate to investor interface to attempt submitting a withdrawal request exceeding profit balance.
        frame = context.pages[-1]
        # Click on 'Dashboard' to navigate away from admin page and prepare to switch to investor interface
        elem = frame.locator('xpath=html/body/div/div[2]/div/div/div[2]/div/div[2]/div/div[2]/ul/li/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        await page.goto('http://localhost:8080', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Attempt to submit a withdrawal request exceeding the profit balance to verify frontend validation.
        frame = context.pages[-1]
        # Click 'Retirer' button to open withdrawal request form
        elem = frame.locator('xpath=html/body/div/div[2]/div/div/div[2]/div/div[2]/div[2]/div[2]/ul/li[5]/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Switch to investor interface to attempt submitting withdrawal requests exceeding and within profit balance.
        await page.goto('http://localhost:8080/dashboard', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Click 'Retirer' button to open withdrawal request form and attempt to submit a withdrawal exceeding profit balance.
        frame = context.pages[-1]
        # Click 'Retirer' button to open withdrawal request form
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/main/div/div/div[2]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input an amount exceeding 367.80 $US and attempt to submit to verify frontend validation prevents submission.
        frame = context.pages[-1]
        # Input withdrawal amount exceeding profit balance (500 > 367.80)
        elem = frame.locator('xpath=html/body/div[3]/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('500')
        

        frame = context.pages[-1]
        # Open payment method dropdown to select a payment method
        elem = frame.locator('xpath=html/body/div[3]/form/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Crypto (USDT TRC20)' payment method and click 'Confirmer le retrait' to attempt submission and verify frontend validation prevents it.
        frame = context.pages[-1]
        # Select 'Crypto (USDT TRC20)' payment method
        elem = frame.locator('xpath=html/body/div[4]/div/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Check for any error messages or validation feedback on the form. If none, try to submit a valid withdrawal request within profit balance next.
        frame = context.pages[-1]
        # Input valid withdrawal amount within profit balance (300)
        elem = frame.locator('xpath=html/body/div[3]/form/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('300')
        

        frame = context.pages[-1]
        # Click 'Confirmer le retrait' to submit valid withdrawal request
        elem = frame.locator('xpath=html/body/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Switch to admin interface to approve the valid withdrawal request and verify profit balance decreases and investor receives approval notification.
        await page.goto('http://localhost:8080/admin', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Close the 'Profil incomplet' modal and check if withdrawal request form can be accessed or profile needs completion.
        frame = context.pages[-1]
        # Click 'Compris' button to close the incomplete profile modal
        elem = frame.locator('xpath=html/body/div[3]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Fill 'Prénom' field with valid data and save profile to complete profile update.
        frame = context.pages[-1]
        # Fill 'Prénom' field to complete profile
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/main/div/div[2]/div[2]/form/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Manasse')
        

        frame = context.pages[-1]
        # Click 'Sauvegarder les modifications' to save profile updates
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/main/div/div[2]/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Retraits en attente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Retirer').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sauvegarder les modifications').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mon Profil').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    