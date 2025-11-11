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
        # -> Click on 'Commencer maintenant' to start login process as investor user.
        frame = context.pages[-1]
        # Click on 'Commencer maintenant' button to start login or registration process.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input investor email and password, then click 'Se connecter' to login as investor user.
        frame = context.pages[-1]
        # Input investor email
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('manassembemba2003@gmail.com')
        

        frame = context.pages[-1]
        # Input investor password
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('2003Manasse')
        

        frame = context.pages[-1]
        # Click 'Se connecter' button to submit login form
        elem = frame.locator('xpath=html/body/div/div[2]/div/div[2]/div[2]/div/div[2]/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Logout investor user and login as admin user to test access to investor protected routes.
        await page.goto('http://localhost:8080/logout', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Click on 'Return to Home' link to navigate back to home or login page for admin login.
        frame = context.pages[-1]
        # Click 'Return to Home' link on 404 error page to navigate back to home or login page.
        elem = frame.locator('xpath=html/body/div/div[2]/div/a').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Wallet' link to access investor protected route and verify admin access.
        frame = context.pages[-1]
        # Click on 'Wallet' link to access investor protected route as admin user.
        elem = frame.locator('xpath=html/body/div/div[2]/div/div/div[2]/div/div[2]/div/div[2]/ul/li[3]/a').nth(0)
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
        await expect(frame.locator('text=Mon Portefeuille').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Consultez vos soldes et effectuez des dépôts ou retraits.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Déposer').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Retirer').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Réinvestir les Profits').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Montant Déposé').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=12,222,212.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Total des dépôts effectués').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Investis').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=1,999.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Montant total investi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Profits').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=+367.80 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Profits disponibles').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Contrats Actifs').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=1').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=En cours').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Historique Récent').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dernières Transactions').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Deposit').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=08/11/2025').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=+12,222,212.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Withdrawal').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=07/11/2025').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=-10.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=-12.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=-10.00 $US').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Profit').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=05/11/2025').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=+399.80 $US').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    