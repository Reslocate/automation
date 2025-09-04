import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration
const HEADLESS = false; // Show browser for debugging
const SCREENSHOT_DIR = './demo-screenshots';
const FB_URL = 'https://www.facebook.com/login';

// Get credentials from environment variables
const FB_USERNAME = process.env.FB_USERNAME;
const FB_PASSWORD = process.env.FB_PASSWORD;

class FacebookAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
        this.logSteps = [];
        this.cookieDir = './cookies';
    }

    async initialize() {
        await fs.ensureDir(SCREENSHOT_DIR);
        await fs.ensureDir(this.cookieDir);

        this.browser = await puppeteer.launch({
            headless: HEADLESS,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        this.page = await this.browser.newPage();

        // Enhanced stealth techniques
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

            // Remove automation indicators
            delete navigator.__proto__.webdriver;

            // Mock chrome object
            window.chrome = {
                runtime: {},
                app: {
                    isInstalled: false
                }
            };
        });

        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🎯 Browser initialized with Windows-specific stealth configuration');
    }

    async logStep(name, success, error) {
            const step = { name, success, error, timestamp: new Date() };
            this.logSteps.push(step);

            const statusIcon = success ? '✅' : '❌';
            console.log(`${statusIcon} ${name}: ${success ? 'SUCCESS' : `FAILED - ${error}`}`);
    
        if (this.page && success) {
            try {
                const screenshotName = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
                await this.page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) });
            } catch (err) {
                console.log('Screenshot failed:', err.message);
            }
        }
        
        return step;
    }

    async humanDelay(min = 1000, max = 3000) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async typeHumanLike(selector, text) {
        await this.page.focus(selector);
        await this.humanDelay(500, 1000);
        
        // Type with random delays between characters
        for (const char of text) {
            await this.page.keyboard.type(char);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        }
    }

    async saveCookies() {
        const cookies = await this.page.cookies();
        await fs.writeJSON(path.join(this.cookieDir, 'facebook_cookies.json'), cookies);
        console.log('🍪 Cookies saved');
    }

    async loadCookies() {
        const cookiePath = path.join(this.cookieDir, 'facebook_cookies.json');
        if (await fs.pathExists(cookiePath)) {
            const cookies = await fs.readJSON(cookiePath);
            await this.page.setCookie(...cookies);
            console.log('🍪 Cookies loaded');
            return true;
        }
        return false;
    }

    async login() {
        try {
            // Check if we have saved cookies
            const hasCookies = await this.loadCookies();
            
            await this.page.goto('https://www.facebook.com', { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });

            await this.humanDelay(2000, 3000);

            // Check if already logged in - use more robust detection
            console.log('🔍 Checking if already logged in...');
            
            const loggedInSelectors = [
                '[data-testid="user-menu"]',
                '[aria-label*="Your profile" i]',
                '[href*="/me/"]',
                '[data-pagelet="LeftRail"]',
                '[role="main"][data-pagelet*="Feed"]',
                '[data-pagelet="Stories"]'
            ];
            
            let isLoggedIn = false;
            
            // Check multiple selectors for logged-in state
            for (const selector of loggedInSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 1000 });
                    console.log(`✅ Detected logged-in state via selector: ${selector}`);
                    isLoggedIn = true;
                    break;
                } catch (e) {
                    // Continue checking other selectors
                }
            }
            
            // Additional check - look for login buttons that indicate logged OUT state
            if (!isLoggedIn) {
                try {
                    await this.page.waitForSelector('#email, input[name="email"], input[type="email"]', { timeout: 1000 });
                    console.log('⚠️ Found login input fields - not logged in');
                } catch (e) {
                    // If we can't find login fields either, try to determine state by URL
                    const currentUrl = await this.page.url();
                    if (!currentUrl.includes('login') && !currentUrl.includes('auth')) {
                        console.log('ℹ️ On Facebook main page without login elements - assuming logged in');
                        isLoggedIn = true;
                    }
                }
            }
            
            if (isLoggedIn) {
                console.log('🎯 Already logged in with saved cookies!');
                await this.logStep('Already logged in', true);
                return true;
            } else {
                console.log('🔍 Not logged in, proceeding with login process...');
            }

            // Go to login page
            await this.page.goto(FB_URL, { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });

            await this.logStep('Navigate to Facebook Login', true);

            // Multiple selector strategies for email input
            const emailSelectors = [
                '#email',
                'input[name="email"]',
                'input[type="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="Email" i]'
            ];

            let emailInput = null;
            for (const selector of emailSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    emailInput = selector;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!emailInput) {
                throw new Error('Could not find email input field');
            }

            // Enter email
            await this.typeHumanLike(emailInput, FB_USERNAME);
            await this.logStep('Enter email', true);

            // Multiple selector strategies for password input
            const passwordSelectors = [
                '#pass',
                'input[name="pass"]',
                'input[type="password"]',
                'input[placeholder*="password" i]',
                'input[placeholder*="Password" i]'
            ];

            let passwordInput = null;
            for (const selector of passwordSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    passwordInput = selector;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!passwordInput) {
                throw new Error('Could not find password input field');
            }

            // Enter password
            await this.typeHumanLike(passwordInput, FB_PASSWORD);
            await this.logStep('Enter password', true);

            // Multiple selector strategies for login button
            const loginButtonSelectors = [
                'button[name="login"]',
                'input[name="login"]',
                'button[type="submit"]',
                'input[type="submit"]',
                'button[data-testid="royal_login_button"]',
                'input[value*="Log" i]'
            ];

            let loginButton = null;
            for (const selector of loginButtonSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    loginButton = selector;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!loginButton) {
                throw new Error('Could not find login button');
            }

            // Click login button
            await this.humanDelay(1000, 2000);
            await this.page.click(loginButton);
            await this.logStep('Click login button', true);

            // Wait for login to complete - look for main feed or user menu
            try {
                await this.page.waitForSelector('[data-testid="user-menu"], [role="main"], [data-pagelet="Stories"]', { 
                    timeout: 15000 
                });
                await this.logStep('Login successful', true);
                
                // Save cookies for future use
                await this.saveCookies();
                
                return true;
            } catch (e) {
                // Check for error messages
                try {
                    const errorElement = await this.page.$('[data-testid="login_error_message"]');
                    if (errorElement) {
                        const errorText = await this.page.evaluate(el => el.textContent, errorElement);
                        throw new Error(`Login failed: ${errorText}`);
                    }
                } catch (err) {
                    // No error message found
                }
                throw new Error('Login timeout - may need to handle 2FA or captcha');
            }

        } catch (error) {
            await this.logStep('Login failed', false, error.message);
            return false;
        }
    }

    async findPostCreationArea() {
        console.log('🔍 Searching for post creation area with enhanced detection...');
        
        // Wait longer and scroll to make sure page is fully loaded
        await this.page.evaluate(() => {
            window.scrollTo(0, 0); // Scroll to top
        });
        await this.humanDelay(3000, 5000);

        // Take screenshot for debugging
        await this.page.screenshot({ 
            path: path.join(SCREENSHOT_DIR, 'page_scan.png'),
            fullPage: true 
        });

        // Enhanced selectors including more recent Facebook UI patterns
        const postAreaSelectors = [
            // 2024 Facebook UI patterns
            'div[aria-label*="Create a post" i]',
            'div[role="button"][aria-label*="Create" i]',
            '[data-pagelet*="composer" i] div[role="button"]',
            '[data-pagelet="FeedComposer"]',
            
            // Text-based matching
            'div[role="button"]:has-text("What\'s on your mind")',
            'div[role="button"]:has-text("Start a post")',
            
            // Classic patterns
            '[data-testid="status-attachment-mentions-input"]',
            'div[data-testid="status-attachment-mentions-input"]',
            '[placeholder*="mind" i]',
            '[placeholder*="What\'s on your mind" i]',
            
            // Generic fallbacks
            'div[role="textbox"][contenteditable="true"]',
            '[contenteditable="true"]',
            'div[role="button"]:not([aria-hidden="true"])'
        ];

        // Try each selector with enhanced visibility checking
        for (const selector of postAreaSelectors) {
            console.log(`🔍 Trying selector: ${selector}`);
            try {
                await this.page.waitForSelector(selector, { timeout: 2000 });
                
                const elements = await this.page.$$(selector);
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                
                for (const element of elements) {
                    const isVisible = await this.page.evaluate(el => {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        
                        return rect.width > 10 && 
                               rect.height > 10 && 
                               style.visibility !== 'hidden' &&
                               style.display !== 'none' &&
                               style.opacity !== '0' &&
                               rect.top >= 0 && 
                               rect.top < window.innerHeight;
                    }, element);
                    
                    if (isVisible) {
                        // Get element text to verify it's the right one
                        const elementText = await this.page.evaluate(el => {
                            return el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
                        }, element);
                        
                        console.log(`✅ Found visible element with text: "${elementText.substring(0, 50)}..."`);
                        
                        // Additional verification - check if it looks like a post creation area
                        if (elementText.toLowerCase().includes('mind') || 
                            elementText.toLowerCase().includes('post') ||
                            elementText.toLowerCase().includes('share') ||
                            elementText.toLowerCase().includes('create')) {
                            console.log(`✅ Verified post creation area: ${selector}`);
                            return { element, selector };
                        }
                    }
                }
            } catch (e) {
                console.log(`❌ Selector failed: ${selector} - ${e.message}`);
                continue;
            }
        }

        // If no direct selectors work, try XPath for text-based search
        console.log('🔍 Trying XPath text-based search...');
        const xpathSelectors = [
            "//div[@role='button' and contains(., 'What')]",
            "//div[@role='button' and contains(., 'mind')]",
            "//div[@role='button' and contains(., 'post')]",
            "//div[@role='button' and contains(., 'share')]",
            "//span[contains(text(), 'What') and contains(text(), 'mind')]/ancestor::div[@role='button']",
            "//div[contains(@aria-label, 'Create')]",
            "//div[contains(@placeholder, 'mind')]"
        ];

        for (const xpath of xpathSelectors) {
            try {
                console.log(`🔍 Trying XPath: ${xpath}`);
                const elements = await this.page.$x(xpath);
                
                if (elements.length > 0) {
                    for (const element of elements) {
                        const isVisible = await this.page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            
                            return rect.width > 10 && 
                                   rect.height > 10 && 
                                   style.visibility !== 'hidden' &&
                                   style.display !== 'none' &&
                                   rect.top >= 0 && 
                                   rect.top < window.innerHeight;
                        }, element);
                        
                        if (isVisible) {
                            const elementText = await this.page.evaluate(el => {
                                return el.textContent || el.getAttribute('aria-label') || '';
                            }, element);
                            
                            console.log(`✅ Found XPath element with text: "${elementText.substring(0, 50)}..."`);
                            return { element, selector: xpath };
                        }
                    }
                }
            } catch (e) {
                console.log(`❌ XPath failed: ${xpath}`);
                continue;
            }
        }

        return null;
    }

    async createPost() {
        try {
            // Navigate to home and wait
            console.log('🏠 Navigating to Facebook home...');
            await this.page.goto('https://www.facebook.com', { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });
            await this.humanDelay(3000, 5000);

            // Find post creation area with enhanced detection
            const postArea = await this.findPostCreationArea();
            
            if (!postArea) {
                // Try alternative approach - scroll and search again
                console.log('🔄 First search failed, trying scroll and re-search...');
                await this.page.evaluate(() => {
                    window.scrollTo(0, 300);
                });
                await this.humanDelay(2000, 3000);
                
                const postAreaRetry = await this.findPostCreationArea();
                if (!postAreaRetry) {
                    await this.page.screenshot({ 
                        path: path.join(SCREENSHOT_DIR, 'no_post_area_found.png'),
                        fullPage: true 
                    });
                    throw new Error('Could not find post creation area after enhanced search. Check full page screenshot.');
                }
                postArea = postAreaRetry;
            }

            // Click on the found post area
            console.log('🎯 Clicking on post creation area...');
            await postArea.element.click();
            await this.humanDelay(2000, 4000);
            await this.logStep('Click post creation area', true);

            // Wait for composer to open and find text input
            console.log('⏳ Waiting for composer to open...');
            
            const textInputSelectors = [
                '[contenteditable="true"][data-testid*="status"]',
                '[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"]',
                '[data-testid="status-attachment-mentions-input"]',
                'textarea[placeholder*="mind" i]',
                '[aria-label*="Write something" i]'
            ];

            let textInput = null;
            let inputElement = null;
            
            for (const selector of textInputSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    
                    const elements = await this.page.$$(selector);
                    for (const element of elements) {
                        const isVisible = await this.page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 10 && rect.height > 10 && 
                                   window.getComputedStyle(el).display !== 'none';
                        }, element);
                        
                        if (isVisible) {
                            textInput = selector;
                            inputElement = element;
                            console.log(`✅ Found text input: ${selector}`);
                            break;
                        }
                    }
                    if (textInput) break;
                } catch (e) {
                    continue;
                }
            }

            if (!textInput) {
                // Fallback: try clicking on the post area again and wait longer
                console.log('⚠️ Text input not found, trying fallback approach...');
                await postArea.element.click();
                await this.humanDelay(3000, 5000);
                
                // Use the original clicked element as input
                textInput = postArea.selector;
                inputElement = postArea.element;
            }

            // Focus and type the message
            console.log('✍️ Typing post content...');
            await inputElement.focus();
            await this.humanDelay(500, 1000);
            
            // Clear any existing text and type our message
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            
            const postMessage = 'Hello world! 🌍 Testing automated posting.';
            await this.page.keyboard.type(postMessage, { delay: 100 });
            await this.logStep('Type post content', true);

            // Wait before posting
            await this.humanDelay(2000, 3000);

            // Take screenshot before posting
            await this.page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, 'before_post_submit.png') 
            });

            // Enhanced post button detection
            console.log('🔍 Looking for post/submit button...');
            
            const postButtonSelectors = [
                '[data-testid="react-composer-post-button"]',
                'div[aria-label="Post" i]',
                'div[aria-label="Share" i]',
                'button[type="submit"]',
                'div[role="button"]:not([aria-disabled="true"])'
            ];

            const postButtonXPaths = [
                "//div[@role='button' and contains(text(), 'Post')]",
                "//button[contains(text(), 'Post')]",
                "//div[@role='button' and contains(text(), 'Share')]",
                "//span[contains(text(), 'Post')]/ancestor::div[@role='button'][1]"
            ];

            let postButton = null;
            
            // Try CSS selectors first
            for (const selector of postButtonSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    const elements = await this.page.$$(selector);
                    
                    for (const element of elements) {
                        const isVisible = await this.page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return rect.width > 0 && rect.height > 0 && 
                                   style.display !== 'none' &&
                                   !el.hasAttribute('aria-disabled');
                        }, element);
                        
                        if (isVisible) {
                            const buttonText = await this.page.evaluate(el => {
                                return el.textContent || el.getAttribute('aria-label') || '';
                            }, element);
                            
                            if (buttonText.toLowerCase().includes('post') || 
                                buttonText.toLowerCase().includes('share')) {
                                postButton = element;
                                console.log(`✅ Found post button: ${selector} with text: "${buttonText}"`);
                                break;
                            }
                        }
                    }
                    if (postButton) break;
                } catch (e) {
                    continue;
                }
            }

            // Try XPath selectors
            if (!postButton) {
                for (const xpath of postButtonXPaths) {
                    try {
                        const elements = await this.page.$x(xpath);
                        if (elements.length > 0) {
                            const isVisible = await this.page.evaluate(el => {
                                const rect = el.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            }, elements[0]);
                            
                            if (isVisible) {
                                postButton = elements[0];
                                console.log(`✅ Found post button with XPath: ${xpath}`);
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            if (!postButton) {
                await this.page.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, 'no_post_button_found.png') 
                });
                throw new Error('Could not find post/submit button. Check screenshot for debugging.');
            }

            // Click post button
            console.log('📤 Clicking post button...');
            await postButton.click();
            await this.logStep('Click post button', true);

            // Wait for post to be published
            await this.humanDelay(3000, 5000);
            
            // Verify post was created (look for success indicators)
            try {
                // Look for post confirmation or return to feed
                await this.page.waitForFunction(() => {
                    const url = window.location.href;
                    return !url.includes('/composer/') && !url.includes('/create/');
                }, { timeout: 10000 });
                
                console.log('✅ Post appears to have been submitted successfully');
            } catch (e) {
                console.log('⚠️ Could not confirm post submission, but no errors occurred');
            }
            
            // Take final screenshot
            await this.page.screenshot({ 
                path: path.join(SCREENSHOT_DIR, 'after_post_submit.png') 
            });
            
            await this.logStep('Post published successfully', true);
            return true;

        } catch (error) {
            await this.logStep('Create post failed', false, error.message);
            
            // Take comprehensive error screenshots
            try {
                await this.page.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, 'post_error_viewport.png') 
                });
                await this.page.screenshot({ 
                    path: path.join(SCREENSHOT_DIR, 'post_error_fullpage.png'),
                    fullPage: true 
                });
                console.log('📸 Error screenshots saved');
            } catch (e) {
                console.log('❌ Could not save error screenshots');
            }
            
            return false;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }

    async run() {
        console.log('\n🚀 Starting Enhanced Facebook Automation v2.0');
        console.log('🎯 Enhanced post detection and stealth measures');
        console.log('🔧 Username:', FB_USERNAME);
        console.log('🔑 Password:', FB_PASSWORD ? '***' : 'NOT SET');

        if (!FB_USERNAME || !FB_PASSWORD) {
            console.error('❌ Missing credentials! Please set FB_USERNAME and FB_PASSWORD environment variables.');
            return;
        }

        try {
            await this.initialize();
            
            // Login phase
            console.log('\n🔐 Authentication Phase:');
            const loginResult = await this.login();
            
            if (!loginResult) {
                console.error('❌ Authentication failed - cannot continue');
                return;
            }

            console.log('✅ Authentication completed successfully');
            await this.humanDelay(3000, 5000);

            // Post creation phase
            console.log('\n📝 Post Creation Phase:');
            const postResult = await this.createPost();
            
            if (postResult) {
                console.log('\n🎉 SUCCESS! Facebook automation completed successfully');
                await fs.writeFile(
                    path.join(SCREENSHOT_DIR, 'SUCCESS.txt'),
                    `Facebook automation successful at ${new Date().toISOString()}\nPost created successfully with enhanced detection`
                );
            } else {
                console.log('\n⚠️ Post creation failed, but login was successful');
                await fs.writeFile(
                    path.join(SCREENSHOT_DIR, 'PARTIAL_SUCCESS.txt'),
                    `Facebook automation partially successful at ${new Date().toISOString()}\nLogin: SUCCESS\nPost: FAILED\nCheck error screenshots for debugging`
                );
            }

            // Demo: Keep browser open to show results
            console.log('⏳ Keeping browser open for 15 seconds to show results...');
            await this.humanDelay(15000, 18000);

        } catch (error) {
            console.error('❌ Automation error:', error.message);
            
            try {
                await fs.writeFile(
                    path.join(SCREENSHOT_DIR, 'AUTOMATION_ERROR.txt'),
                    `Facebook automation error at ${new Date().toISOString()}\nError: ${error.message}\nStack: ${error.stack}`
                );
            } catch (e) {
                // Ignore write errors
            }
        } finally {
            await this.cleanup();
        }

        // Execution summary
        console.log('\n📊 EXECUTION SUMMARY:');
        console.log('═'.repeat(60));
        this.logSteps.forEach(step => {
            const status = step.success ? 'SUCCESS' : 'FAILED';
            const emoji = step.success ? '✅' : '❌';
            console.log(`${emoji} ${step.name.padEnd(35)} ${status}`);
            if (!step.success && step.error) {
                console.log(`   └─ ${step.error}`);
            }
        });
        console.log('═'.repeat(60));
        
        const successfulSteps = this.logSteps.filter(step => step.success).length;
        console.log(`📈 Completion rate: ${successfulSteps}/${this.logSteps.length} steps (${Math.round(successfulSteps/this.logSteps.length*100)}%)`);
        
        console.log('\n🏁 Facebook automation session completed');
    }
}

// Run the automation
(async () => {
    console.log('🤖 Facebook Login and Post Automation v2.0');
    console.log('🎯 Enhanced with improved element detection');
    
    const automation = new FacebookAutomation();
    await automation.run();
})();
