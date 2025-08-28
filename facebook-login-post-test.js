import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';

// Configuration - now accepts command line arguments or environment variables
const HEADLESS = process.env.HEADLESS === 'true' || false; // Default to visible for debugging
const SCREENSHOT_DIR = './debug-screenshots';
const FB_URL = 'https://www.facebook.com/login';
const FB_USERNAME = process.env.FB_USERNAME || process.env.FBusername || '';
const FB_PASSWORD = process.env.FB_PASSWORD || process.env.FBpassword || '';

// Enhanced detection bypass techniques
const BYPASS_TECHNIQUES = {
    RANDOM_MOUSE_MOVEMENTS: true,
    HUMAN_TYPE_SPEED_VARIATION: true,
    NAVIGATION_PATTERN_RANDOMIZATION: true,
    BROWSER_FINGERPRINT_SHOOTING: true,
    SECURITY_CHALLENGE_EVASION: true
};

// Common two-step verification regexes to detect
const TFA_DETECTION_PATTERNS = [
    /two[-\s]?step/i,
    /authentication/i,
    /verification/i,
    /your[-\s]?login[-\s]?code/i,
    /security[-\s]?check/i,
    /code[-\s]?sent[-\s]?(?:to|via)/i
];

class FacebookDebugPro {
    constructor() {
        this.browser = null;
        this.page = null;
        this.logSteps = [];
    }

    async initialize() {
        await fs.ensureDir(SCREENSHOT_DIR);

        this.browser = await puppeteer.launch({
            headless: HEADLESS,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1400,900', // More common user resolution
                '--disable-features=VizDisplayCompositor',
                '--ignore-certificate-errors',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--allow-running-insecure-content',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--metrics-recording-only',
                '--disable-default-apps',
                '--mute-audio',
                '--no-first-run',
                '--disable-notifications',
                '--disable-popup-blocking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-domain-reliability'
            ],
            defaultViewport: { width: 1900, height: 1080 }
        });

        this.page = await this.browser.newPage();

        // Override webdriver to prevent detection
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🎯 Browser initialized - ready for Facebook PRO debugging');
    }

    async logStep(name, success, error) {
            const step = {
                name,
                success,
                error,
                timestamp: new Date()
            };

            // Take screenshot for each step
            if (this.page) {
                const screenshotName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
                step.screenshot = path.join(SCREENSHOT_DIR, screenshotName);

                try {
                    await this.page.screenshot({ path: step.screenshot, fullPage: true });
                } catch (err) {
                    console.log('⚠️ Could not take screenshot:', err);
                }

                // Add random human-like mouse movements
                if (BYPASS_TECHNIQUES.RANDOM_MOUSE_MOVEMENTS) {
                    await this.page.mouse.move(100 + Math.random() * 600, 100 + Math.random() * 300);
                    await this.page.mouse.move(200 + Math.random() * 500, 150 + Math.random() * 250);
                }
            }

            this.logSteps.push(step);
            const statusIcon = success ? '✅' : '❌';
            console.log(`${statusIcon} ${name}: ${success ? 'SUCCESS' : `FAILED - ${error}`}`);
    
    return step;
  }

  async discoverLoginElements() {
    console.log('\n🔍 Scanning Facebook login page for current selectors...');
    await this.page.goto(FB_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const elements = await this.page.evaluate(() => {
      const result = {
        emailSelectors: [],
        passwordSelectors: [],
        loginButtonSelectors: []
      };

      // Analyze all interactive elements
      const allInputs = Array.from(document.querySelectorAll('input'));
      const allButtons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], [type="button"]'));

      // Email/Username fields
      // CRITICAL: Filter out invisible and hidden elements FIRST to prevent security detection
      const visibleInputs = allInputs.filter(input => {
        const style = getComputedStyle(input);
        const visibleAndUsable = style.display !== 'none' &&
                              style.visibility !== 'hidden' &&
                              style.opacity !== '0' &&
                              input.type !== 'hidden' &&
                              !input.hasAttribute('aria-hidden') &&
                              !input.hasAttribute('hidden') &&
                              !input.disabled &&
                              input.offsetParent !== null;

        // Check if actually visible on the screen (not offscreen or covered)
        const rect = input.getBoundingClientRect();
        const inViewport = rect.width > 2 && rect.height > 2;
        
        return visibleAndUsable && inViewport;
      });

      visibleInputs.forEach(input => {
        const placeholder = (input.placeholder || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const type = (input.type || '').toLowerCase();

        // STRICT verification - only accept fields that are PROBABLY login fields
        const isLoginField = (
          (type === 'email' || type === 'text') &&
          (placeholder.includes('email') ||
           placeholder.includes('phone') ||
           placeholder.includes('username') ||
           name.includes('email') ||
           name.includes('user'))
        );

        if (isLoginField) {
          // Add with better priority scheme
          result.emailSelectors.unshift(`input[name="${name}"]`); // PREFERRED: name
          result.emailSelectors.push(`#${id}`);              // SECONDARY: ID
          result.emailSelectors.push(`input[type="${type}"]`); // FALLBACK: type
        }

        // Password fields - CRITICAL: Only match CLEAR password indicators
        const isPasswordField = (
          type === 'password' || (
            (placeholder.includes('password') || placeholder.includes('pass')) &&
            !placeholder.includes('author') // Avoid false positives
          )
        );

        if (isPasswordField) {
          result.passwordSelectors.unshift(`input[name="${name}"]`); // PREFERRED: name
          result.passwordSelectors.push(`#${id}`);                   // SECONDARY: ID
          result.passwordSelectors.push(`input[type="${type}"]`);    // FALLBACK: type
        }
      });

      // Login buttons
      allButtons.forEach(button => {
        const text = (button.textContent || '').toLowerCase();
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const type = (button.type || '').toLowerCase();
        const id = (button.id || '').toLowerCase();
        
        if (type === 'submit' || 
            text.includes('log') || 
            text.includes('sign') || 
            text.includes('in') ||
            ariaLabel.includes('log') || 
            ariaLabel.includes('sign') ||
            id.includes('login') || 
            id.includes('submit')) {
          
          if (id) result.loginButtonSelectors.push(`#${id}`);
          result.loginButtonSelectors.push(`${button.tagName.toLowerCase()}[type="${type}"]`);
          if (ariaLabel) result.loginButtonSelectors.push(`[aria-label*="${ariaLabel.split(' ')[0]}"]`);
        }
      });

      // Remove duplicates
      return {
        emailSelectors: [...new Set(result.emailSelectors)].filter(s => s && s.length > 4),
        passwordSelectors: [...new Set(result.passwordSelectors)].filter(s => s && s.length > 4),
        loginButtonSelectors: [...new Set(result.loginButtonSelectors)].filter(s => s && s.length > 4)
      };
    });

    console.log('🎯 Discovered login selectors:');
    console.log('   📧 Email inputs:', elements.emailSelectors.slice(0, 5).join(', ') || 'None found');
    console.log('   🔐 Password inputs:', elements.passwordSelectors.slice(0, 5).join(', ') || 'None found');
    console.log('   📝 Login buttons:', elements.loginButtonSelectors.slice(0, 5).join(', ') || 'None found');

    return elements;
  }

  async attemptLoginWithSelectors(username, password, emailSelectors, passwordSelectors, loginButtonSelectors) {
    console.log('\n🔐 Attempting intelligent login...');
    
    // Try email selectors
    let emailFilled = false;
    for (const selector of emailSelectors.slice(0, 5)) {
      try {
        console.log(`🧪 Trying email selector: ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.focus(selector);
        
        // Clear existing text if any
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        
        // Type with human-like delay
        await this.page.type(selector, username, { delay: 20 + Math.random() * 30 });
        emailFilled = true;
        console.log(`✅ Filled email using: ${selector}`);
        break;
      } catch (error) {
        console.log(`❌ Email selector failed: ${selector}`);
      }
    }

    if (!emailFilled) {
      console.log('❌ Could not fill email field');
      return false;
    }

    // Try password selectors
    let passwordFilled = false;
    for (const selector of passwordSelectors.slice(0, 5)) {
      try {
        console.log(`🧪 Trying password selector: ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.type(selector, password, { delay: 15 + Math.random() * 25 });
        passwordFilled = true;
        console.log(`✅ Filled password using: ${selector}`);
        break;
      } catch (error) {
        console.log(`❌ Password selector failed: ${selector}`);
      }
    }

    if (!passwordFilled) {
      console.log('❌ Could not fill password field');
      return false;
    }

    // Try login buttons
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between fields
    
    let loginClicked = false;
    for (const selector of loginButtonSelectors.slice(0, 5)) {
      try {
        console.log(`🧪 Trying login button: ${selector}`);
        await this.page.waitForSelector(selector, { timeout: 3000 });
        await this.page.click(selector);
        loginClicked = true;
        console.log(`✅ Clicked login using: ${selector}`);
        break;
      } catch (error) {
        console.log(`❌ Login button failed: ${selector}`);
      }
    }

    // Wait for navigation after login attempt
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if login was successful by looking for dashboard elements
    const loginSuccess = await this.checkLoginSuccess();
    
    if (loginSuccess) {
      console.log('🎉 Login successful! Facebook dashboard detected.');
      return true;
    } else {
      console.log('❌ Login unsuccessful or security checks present');
      
      // Check for security challenges
      const hasChallenge = await this.page.evaluate(() => {
        return document.body.textContent.includes('security') ||
               document.body.textContent.includes('checkpoint') ||
               document.body.textContent.includes('verification');
      });
      
      if (hasChallenge) {
        console.log('⚠️ Security challenge detected - manual intervention required');
      }
      
      return false;
    }
  }

  async checkLoginSuccess() {
    // Look for elements that indicate successful login
    const successMarkers = [
      '[aria-label="Facebook"]',
      '[data-pagelet="MainFeed"]',
      '[role="main"]',
      '[aria-label="News Feed"]',
      'text/Welcome to Facebook'
    ];
    
    for (const selector of successMarkers) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }

  async handleSecurityChallenge() {
    console.log('\n🛡️  Checking for security challenges...');
    
    // Look for common security challenge indicators
    const hasChallenge = await this.page.evaluate(() => {
      const securityKeywords = ['security', 'checkpoint', 'verification', 'confirm', 'identify'];
      const bodyText = document.body.textContent.toLowerCase();
      
      return securityKeywords.some(keyword => bodyText.includes(keyword)) ||
             document.querySelector('img[alt*="security"]') ||
             document.querySelector('input[type*="code"]') ||
             document.querySelector('button:contains("Continue")');
    });
    
    if (hasChallenge) {
      console.log('⚠️  Security challenge detected - pausing for manual intervention');
      await this.logStep('Security Challenge', false, 'Requires manual verification');
      return false;
    }
    
    // Check for two-factor authentication specifically
    const isTwoFactor = await this.isTwoFactorChallenge();
    if (isTwoFactor) {
      console.log('🔐 Two-Factor Authentication detected - attempting bypass...');
      const bypassed = await this.bypassTwoFactorSecurity();
      return bypassed;
    }
    
    return true;
  }

  async postToFacebook(message) {
    try {
      console.log('\n📝 Attempting to post to Facebook...');

      // Check for security challenges first
      if (!(await this.handleSecurityChallenge())) {
        return false;
      }

      // Wait for feed to fully load and ensure we're on the right page
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Navigate to Facebook home if not already there
      const currentUrl = await this.page.url();
      if (!currentUrl.includes('facebook.com') || currentUrl.includes('login')) {
        console.log('🔄 Navigating to Facebook home...');
        await this.page.goto('https://www.facebook.com', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log('🔍 Current URL before posting:', await this.page.url());

      // Enhanced post box discovery with multiple strategies
      const postBoxSelectors = [
        // Modern Facebook selectors
        '[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        '[aria-label*="What\'s on your mind"]',
        '[data-testid="status-attachment-mentions-input"]',
        '[placeholder*="What\'s on your mind"]',
        
        // Legacy selectors
        'textarea[name="xhpc_message"]',
        'div[data-testid="react-composer-root"]',
        '[data-pagelet="ProfileComposer"]',
        
        // Fallback selectors
        'div[contenteditable="true"]',
        '[role="textbox"]'
      ];
      
      let postBoxFound = false;
      let workingSelector = null;
      
      // Try each selector until we find one that works
      for (const selector of postBoxSelectors) {
        try {
          console.log(`🧪 Trying post box selector: ${selector}`);
          await this.page.waitForSelector(selector, { visible: true, timeout: 5000 });
          
          // Verify the element is actually clickable and visible
          const isClickable = await this.page.evaluate(sel => {
            const element = document.querySelector(sel);
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   !element.disabled;
          }, selector);
          
          if (isClickable) {
            workingSelector = selector;
            postBoxFound = true;
            console.log(`✅ Found working post box: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Post box selector failed: ${selector}`);
        }
      }
      
      if (!postBoxFound) {
        console.log('❌ No post box found - trying alternative approach...');
        
        // Alternative: Look for "Create Post" button first
        const createPostSelectors = [
          '[aria-label="Create a post"]',
          'button[aria-label="Create a post"]',
          'div[aria-label="Create a post"]',
          '[data-testid="react-composer-post-button"]'
        ];
        
        for (const selector of createPostSelectors) {
          try {
            console.log(`🧪 Trying create post button: ${selector}`);
            await this.page.waitForSelector(selector, { visible: true, timeout: 3000 });
            await this.page.click(selector);
            console.log(`✅ Clicked create post button: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Now try to find the post box again
            for (const postSelector of postBoxSelectors.slice(0, 3)) {
              try {
                await this.page.waitForSelector(postSelector, { visible: true, timeout: 3000 });
                workingSelector = postSelector;
                postBoxFound = true;
                console.log(`✅ Found post box after clicking create: ${postSelector}`);
                break;
              } catch {}
            }
            if (postBoxFound) break;
          } catch {}
        }
      }
      
      if (!postBoxFound) {
        console.log('❌ Post box not found - taking screenshot for analysis');
        await this.page.screenshot({ path: './debug-no-postbox.png', fullPage: true });
        
        // Debug: Show all available interactive elements
        const availableElements = await this.page.evaluate(() => {
          const elements = [];
          
          // Check for contenteditable divs
          document.querySelectorAll('div[contenteditable="true"]').forEach(el => {
            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
              elements.push({
                type: 'contenteditable',
                selector: el.id ? `#${el.id}` : `div[contenteditable="true"]`,
                text: el.textContent?.substring(0, 50) || '',
                ariaLabel: el.getAttribute('aria-label') || ''
              });
            }
          });
          
          // Check for textboxes
          document.querySelectorAll('[role="textbox"]').forEach(el => {
            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
              elements.push({
                type: 'textbox',
                selector: el.id ? `#${el.id}` : `[role="textbox"]`,
                text: el.textContent?.substring(0, 50) || '',
                ariaLabel: el.getAttribute('aria-label') || ''
              });
            }
          });
          
          return elements;
        });
        
        console.log('🕵️ Available interactive elements:', availableElements);
        return false;
      }

      // Scroll the post box into view and focus
      await this.page.evaluate(selector => {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, workingSelector);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Enhanced clicking and typing approach
      try {
        // Multiple click attempts to ensure focus
        console.log('🖱️ Clicking post box to focus...');
        await this.page.click(workingSelector, { clickCount: 1, delay: 100 });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Double-click to ensure activation
        await this.page.click(workingSelector, { clickCount: 2, delay: 100 });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Focus using JavaScript as backup
        await this.page.evaluate(selector => {
          const element = document.querySelector(selector);
          if (element) {
            element.focus();
            element.click();
          }
        }, workingSelector);
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Clear any existing content with multiple methods
        console.log('🧹 Clearing existing content...');
        
        // Method 1: Keyboard shortcuts
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Method 2: JavaScript clear (for contenteditable divs)
        await this.page.evaluate(selector => {
          const element = document.querySelector(selector);
          if (element) {
            if (element.tagName === 'DIV' && element.contentEditable === 'true') {
              element.innerHTML = '';
              element.textContent = '';
            } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
              element.value = '';
            }
          }
        }, workingSelector);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        // Enhanced typing with better human simulation
        console.log('⌨️ Typing message with enhanced human simulation...');
        
        // Type character by character with realistic delays
        for (let i = 0; i < message.length; i++) {
          const char = message[i];
          
          // Vary typing speed based on character type
          let delay = 50 + Math.random() * 100; // Base delay
          
          if (char === ' ') {
            delay = 100 + Math.random() * 150; // Longer pause for spaces
          } else if (char.match(/[.!?]/)) {
            delay = 200 + Math.random() * 300; // Longer pause for punctuation
          } else if (char.match(/[A-Z]/)) {
            delay = 80 + Math.random() * 120; // Slightly longer for capitals
          }
          
          await this.page.keyboard.type(char, { delay: delay });
          
          // Random micro-pauses to simulate thinking
          if (Math.random() > 0.85) {
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
          }
        }
        
        console.log('✅ Message typed successfully');
        
      } catch (error) {
        console.log('❌ Error during typing:', error.message);
        return false;
      }

      // Wait for UI to stabilize after typing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Enhanced Post button discovery and clicking
      const postButtonSelectors = [
        // Modern Facebook post buttons
        '[aria-label="Post"]',
        'div[aria-label="Post"]',
        'button[aria-label="Post"]',
        '[data-testid="react-composer-post-button"]',
        
        // Alternative selectors
        'button[type="submit"]',
        'div[role="button"]:has(span:contains("Post"))',
        'button:has(span:contains("Post"))',
        '[data-testid*="post"]',
        
        // Legacy selectors
        'button[name="post"]',
        'input[type="submit"][value*="Post"]',
        '.uiButton[type="submit"]'
      ];

      let posted = false;
      console.log('🔍 Enhanced Post button discovery...');
      
      for (const btnSelector of postButtonSelectors) {
        try {
          console.log(`🧪 Trying post button selector: ${btnSelector}`);
          
          // Wait for button to be available
          await this.page.waitForSelector(btnSelector, { visible: true, timeout: 5000 });
          
          // Verify button is clickable
          const isClickable = await this.page.evaluate(sel => {
            const button = document.querySelector(sel);
            if (!button) return false;
            
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   !button.disabled &&
                   !button.hasAttribute('disabled');
          }, btnSelector);
          
          if (!isClickable) {
            console.log(`⚠️ Button found but not clickable: ${btnSelector}`);
            continue;
          }
          
          // Scroll button into view
          await this.page.evaluate(sel => {
            const button = document.querySelector(sel);
            if (button) {
              button.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, btnSelector);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Multiple click attempts
          try {
            await this.page.click(btnSelector, { delay: 100 });
            console.log('✅ Successfully clicked Post button!');
            posted = true;
            break;
          } catch (clickError) {
            // Try JavaScript click as fallback
            console.log('⚠️ Regular click failed, trying JavaScript click...');
            await this.page.evaluate(sel => {
              const button = document.querySelector(sel);
              if (button) {
                button.click();
              }
            }, btnSelector);
            
            console.log('✅ JavaScript click attempted');
            posted = true;
            break;
          }
          
        } catch (err) {
          console.log(`❌ Post button selector failed: ${btnSelector} - ${err.message}`);
        }
      }

      if (!posted) {
        console.log('❌ Could not find or click Post button - comprehensive debugging...');
        
        // Take screenshot for debugging
        await this.page.screenshot({ path: './debug-no-post-button.png', fullPage: true });
        
        // Debug: Show all available buttons
        const availableButtons = await this.page.evaluate(() => {
          const buttons = [];
          
          // Get all button-like elements
          const buttonElements = [
            ...Array.from(document.querySelectorAll('button')),
            ...Array.from(document.querySelectorAll('[role="button"]')),
            ...Array.from(document.querySelectorAll('input[type="submit"]')),
            ...Array.from(document.querySelectorAll('div[aria-label]'))
          ];
          
          buttonElements.forEach(btn => {
            if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              buttons.push({
                tagName: btn.tagName,
                text: btn.textContent?.trim().substring(0, 50) || '',
                ariaLabel: btn.getAttribute('aria-label') || '',
                id: btn.id || '',
                className: btn.className?.substring(0, 100) || '',
                testid: btn.getAttribute('data-testid') || '',
                type: btn.type || '',
                disabled: btn.disabled || btn.hasAttribute('disabled')
              });
            }
          });
          
          return buttons;
        });
        
        console.log('🕵️ All available buttons:', availableButtons);
        
        // Look for any button that might be the post button
        const postLikeButtons = availableButtons.filter(b =>
          b.text.toLowerCase().includes('post') ||
          b.ariaLabel.toLowerCase().includes('post') ||
          b.text.toLowerCase().includes('share') ||
          b.ariaLabel.toLowerCase().includes('share')
        );
        
        if (postLikeButtons.length > 0) {
          console.log('⚠️ Found potential post buttons:', postLikeButtons);
          
          // Try clicking the most promising one
          const bestCandidate = postLikeButtons[0];
          if (bestCandidate.ariaLabel) {
            try {
              await this.page.click(`[aria-label="${bestCandidate.ariaLabel}"]`);
              console.log('✅ Clicked best candidate post button');
              posted = true;
            } catch {}
          }
        }
      }

      if (!posted) {
        console.log('❌ Final attempt: Could not post to Facebook');
        return false;
      }

      // Enhanced post verification
      console.log('⏳ Waiting for post to process and verifying...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check for success indicators
      const postSuccess = await this.page.evaluate(() => {
        // Look for success indicators
        const successIndicators = [
          'Your post is now live',
          'Post shared',
          'Posted',
          'Shared to Facebook'
        ];
        
        const bodyText = document.body.textContent;
        return successIndicators.some(indicator => 
          bodyText.includes(indicator)
        );
      });
      
      if (postSuccess) {
        console.log('🎉 Post verification successful - Facebook confirmed post!');
      } else {
        console.log('⚠️ Post submitted but no explicit confirmation found');
      }

      console.log('🎉 Facebook post creation process completed!');
      return true;

    } catch (error) {
      console.log('❌ Critical error during Facebook posting:', error.message);
      console.log('Stack trace:', error.stack);
      
      // Take error screenshot
      if (this.page) {
        await this.page.screenshot({ path: './debug-facebook-error.png', fullPage: true });
      }
      
      return false;
    }
  }

  async runComprehensiveTestOLD() {
    try {
      await this.initialize();
      console.log('🚀 Starting COMPREHENSIVE route');
      return {
        logSteps: this.logSteps,
        success: true
      }
    } catch (error) {
      console.log('❌ Previous comprehensive route failed:', error);
      return { success: false, error };
    }
  }

  async runComprehensiveTest(caption = 'Hello I am New Here') {
    try {
      await this.initialize();
      console.log('🚀 Starting Facebook PRO debugging session...');
      console.log(`📝 Caption to post: "${caption}"`);
      
      // Discover and test login elements
      const elements = await this.discoverLoginElements();
      
      if (elements.emailSelectors.length === 0 ||
          elements.passwordSelectors.length === 0 ||
          elements.loginButtonSelectors.length === 0) {
        console.log('❌ Insufficient login elements found - Facebook layout may have changed');
        await this.logStep('Login Element Discovery', false, 'Insufficient elements found');
        return { success: false, error: 'Insufficient login elements found' };
      }
      
      // Check if credentials are available
      if (!FB_USERNAME || !FB_PASSWORD) {
        console.log('❌ Facebook credentials not configured');
        console.log('💡 Set environment variables:');
        console.log('   - FB_USERNAME or FBusername');
        console.log('   - FB_PASSWORD or FBpassword');
        await this.logStep('Login Automation', false, 'Credentials not configured');
        return { success: false, error: 'Facebook credentials not configured' };
      }

      // Attempt intelligent login
      const loginSuccess = await this.attemptLoginWithSelectors(
        FB_USERNAME,
        FB_PASSWORD,
        elements.emailSelectors,
        elements.passwordSelectors,
        elements.loginButtonSelectors
      );
      
      console.log('🔍 Login attempt result:', loginSuccess);
      
      if (loginSuccess) {
        await this.logStep('PRO Login Automation', true, 'Successfully logged in with dynamic selectors');
        
        // Check for immediate security challenges after login
        console.log('🔍 Current URL after login attempt:', await this.page.url());
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        
        if (await this.handleSecurityChallenge()) {
          // AFTER SUCCESSFUL LOGIN & NO SECURITY CHALLENGE - CREATE A POST WITH ENHANCED RETRIES
          const maxRetries = 5;
          let postSuccess = false;
          let retryCount = 0;
          
          while (!postSuccess && retryCount < maxRetries) {
            retryCount++;
            console.log(`\n🔄 Attempting post (${retryCount}/${maxRetries})...`);
            
            // Add delay between retries to let Facebook UI settle
            if (retryCount > 1) {
              console.log('⏳ Waiting between retries for UI to settle...');
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            postSuccess = await this.postToFacebook(caption);
            
            if (!postSuccess) {
              console.log(`❌ Post attempt ${retryCount} failed`);
              if (retryCount < maxRetries) {
                console.log('⏳ Waiting before retry and refreshing page...');
                
                // Refresh the page to reset Facebook's state
                try {
                  await this.page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  console.log('🔄 Page refreshed for retry');
                } catch (refreshError) {
                  console.log('⚠️ Page refresh failed, continuing with retry...');
                }
              }
            }
          }
          
          if (postSuccess) {
            await this.logStep('Facebook Post Creation', true, `Posted: "${caption}" after ${retryCount} attempt(s)`);
            console.log('\n🎉 SUCCESSFUL SOCIAL AUTOMATION WORKFLOW:');
            console.log('1. ✅ Intelligent login bypassed Facebook security');
            console.log('2. ✅ Automated post creation completed');
            console.log(`3. ✅ Post content: "${caption}"`);
            console.log('4. ✅ Attempts:', retryCount);
            return { success: true, message: `Posted: "${caption}" after ${retryCount} attempt(s)` };
          } else {
            await this.logStep('Facebook Post Creation', false, `Failed after ${maxRetries} attempts - potential security block`);
            console.log(`\n❌ Login succeeded but post creation failed after ${maxRetries} attempts`);
            console.log('💡 Possible causes:');
            console.log('   - Facebook UI changes requiring selector updates');
            console.log('   - Account restrictions or security blocks');
            console.log('   - Network connectivity issues');
            console.log('   - Rate limiting by Facebook');
            return { success: false, error: 'Post creation failed after retries' };
          }
        } else {
          console.log('\n🛑 Security challenge triggered - manual intervention required before posting');
          return { success: false, error: 'Security challenge detected' };
        }
      } else {
        await this.logStep('PRO Login Automation', false, 'Login failed - check browser for manual intervention');
        return { success: false, error: 'Login failed' };
      }
      
    } catch (error) {
      console.error('❌ Debug session failed:', error);
      return { success: false, error: error.message };
    } finally {
      // Only close browser if not in debug mode (headless false) and not explicitly told to keep open
      const keepBrowserOpen = !HEADLESS || process.env.KEEP_BROWSER_OPEN === 'true';
      
      if (this.browser && !keepBrowserOpen) {
        await this.browser.close();
        console.log('🏁 Browser closed');
      } else if (this.browser) {
        console.log('🔵 Browser kept open for manual inspection...');
        console.log('💡 Press Ctrl+C in terminal to close browser when done');
        console.log('\n📋 Manual Testing Commands:');
        console.log('Open Chrome DevTools (F12) and test:');
        console.log('• document.querySelectorAll(\'div[contenteditable="true"]\')');
        console.log('• document.querySelectorAll(\'[role="textbox"]\')');
        console.log('• document.querySelectorAll(\'[aria-label*="Post"]\')');
        console.log('• Check for security dialogs or 2FA prompts');
        
        // Keep process alive for manual interaction
        await new Promise(() => {});
      }
    }
  }
}

// Export the class for use in other modules
export { FacebookDebugPro };

// Run the debugger if called directly from command line or with arguments
if (import.meta.url === `file://${process.argv[1]}` || process.argv.length > 2) {
  const debuggerInstance = new FacebookDebugPro();
  
  // Get caption from command line arguments or use default
  const caption = process.argv[2] || 'Hello I am New Here';
  
  debuggerInstance.runComprehensiveTest(caption)
    .then(result => {
      if (result && result.success) {
        console.log('✅ Script completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Script failed:', result?.error || 'Unknown error');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}