/**
 * Automated Tournament Testing Script
 * Logs in 8 users and has them join a tournament automatically
 */

const puppeteer = require('puppeteer');

const users = [
  'bunda1', 'bunda2', 'bunda3', 'bunda4',
  'bunda5', 'bunda6', 'bunda7', 'bunda8'
];
const password = 'testpassword123';

async function loginAndJoinTournament(username, instanceNum) {
  console.log(`\n🚀 [${username}] Launching browser instance ${instanceNum}...`);
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for visual testing
    args: [
      `--window-position=${(instanceNum % 4) * 400},${Math.floor(instanceNum / 4) * 500}`,
      '--window-size=400,500'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to login page
    console.log(`🔐 [${username}] Navigating to login page...`);
    await page.goto('http://localhost:3010/login', { waitUntil: 'networkidle2' });
    
    // Fill in login form
    console.log(`✍️  [${username}] Filling login form...`);
    await page.type('input[name="email"], input[type="email"]', `${username}@test.com`);
    await page.type('input[name="password"], input[type="password"]', password);
    
    // Click login button
    console.log(`🔑 [${username}] Submitting login...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]')
    ]);
    
    console.log(`✅ [${username}] Logged in successfully!`);
    
    // Navigate to game page
    console.log(`🎮 [${username}] Going to game page...`);
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Click tournament button
    console.log(`🏆 [${username}] Clicking tournament button...`);
    const tournamentButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Tournament'));
    });
    
    if (tournamentButton) {
      await tournamentButton.click();
      await page.waitForTimeout(1000);
      
      // Click the "Start Game" or "Play" button
      console.log(`▶️  [${username}] Clicking start button...`);
      const startButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.textContent.includes('Start') || 
          btn.textContent.includes('Play') ||
          btn.textContent.includes('Join')
        );
      });
      
      if (startButton) {
        await startButton.click();
        console.log(`✅ [${username}] Joined tournament queue!`);
      }
    }
    
    // Keep browser open to watch the tournament
    console.log(`👀 [${username}] Ready - keeping browser open to watch tournament...`);
    
  } catch (error) {
    console.error(`❌ [${username}] Error:`, error.message);
    await browser.close();
  }
}

async function main() {
  console.log('🏆 AUTOMATED TOURNAMENT TESTING');
  console.log('================================\n');
  console.log('Launching 8 browser instances and joining tournament...\n');
  
  // Launch all users with 2 second delays between each
  for (let i = 0; i < users.length; i++) {
    loginAndJoinTournament(users[i], i + 1);
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
  }
  
  console.log('\n✅ All instances launched!');
  console.log('💡 Press Ctrl+C to close all browsers');
}

main().catch(console.error);
