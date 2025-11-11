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
        # -> Click on 'Créer mon compte' or find login to access admin dashboard for RPC testing.
        frame = context.pages[-1]
        # Click 'Créer mon compte' button to proceed to login or registration page.
        elem = frame.locator('xpath=html/body/div/div[2]/div[4]/div/button').nth(0)
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
        

        # -> Locate and call the RPC get_investor_list_details from the admin dashboard.
        frame = context.pages[-1]
        # Click 'Utilisateurs' (Users) menu to find RPC or investor list details.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div/div[2]/div/div[2]/div[2]/div[2]/ul/li[6]/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Identify and trigger the RPC get_investor_list_details to retrieve investor list details including phone numbers in JSONB format.
        frame = context.pages[-1]
        # Click the action button for the last investor to check if it triggers the RPC or shows details including phone number.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/main/div/div[2]/div[2]/div/table/tbody/tr[6]/td[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click 'Voir les détails' to trigger the RPC and verify the returned investor details including phone numbers in JSONB format.
        frame = context.pages[-1]
        # Click 'Voir les détails' to trigger the RPC get_investor_list_details and view investor details.
        elem = frame.locator('xpath=html/body/div[2]/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Verify if there is another way to access or trigger the RPC get_investor_list_details to include phone numbers in JSONB format or check contract navigation links for each investor.
        frame = context.pages[-1]
        # Close the investor details modal by clicking the 'Close' button.
        elem = frame.locator('xpath=html/body/div[4]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click 'Voir les contrats' to verify the contract navigation link for the investor works correctly.
        frame = context.pages[-1]
        # Click 'Voir les contrats' to verify the contract navigation link for the investor.
        elem = frame.locator('xpath=html/body/div[2]/div/div[3]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Investisseur').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dashboard').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mes Contrats').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Wallet').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Transactions').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Administration').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Admin Dashboard').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dépôts en attente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Retraits en attente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Remboursements en attente').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Gestion Contrats').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Utilisateurs').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Paramètres').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Contrats de manassembemba2003@gmail.com').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Contrat #d3388b44').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Pending_refund').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=1 999,00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Progression').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=/ 10 mois').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Début: 5 octobre 2025').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Fin: 5 août 2026').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    