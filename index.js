import fs from 'fs';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Settings
const BASE_URL = 'https://campaign.cicada.finance/api';
const CAMPAIGN_ID = 440;

// Load accounts
const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf-8'));

// Load proxies
let proxies = [];
try {
  proxies = fs.readFileSync('proxy.txt', 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length && !line.startsWith('#'));
} catch (e) {
  proxies = [];
}

function getRandomProxy() {
  if (!proxies.length) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

// User-agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/137.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];
function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Colors for logging
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m"
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: (accIdx) => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(` Cicada Auto Bot - Airdrop Insiders  `);
    console.log(` Account #${accIdx + 1} `);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  }
};

function getAxiosConfig(AUTH_TOKEN, COOKIES) {
  const proxyUrl = getRandomProxy();
  const config = {
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.6',
      'authorization': AUTH_TOKEN,
      'content-type': 'application/json',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1',
      'cookie': COOKIES,
      'Referer': 'https://campaign.cicada.finance/campaigns/6d70de3a-60ea-4896-b713-276de1bc02c7?code=g1nLayZV',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'user-agent': getRandomUserAgent()
    }
  };
  if (proxyUrl) {
    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    config.httpAgent = new HttpsProxyAgent(proxyUrl);
    logger.info(`Using proxy: ${proxyUrl}`);
  }
  return config;
}

async function axiosWithRetry(method, url, data, config, retries = 3, retryDelay = 60000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (method === 'get') {
        return await axios.get(url, config);
      } else if (method === 'post') {
        return await axios.post(url, data, config);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn(`Rate limited (429). Waiting ${retryDelay / 1000}s before retrying... (Attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Failed after ${retries} retries due to repeated 429 errors.`);
}

async function fetchCompletedPoints(AUTH_TOKEN, COOKIES) {
  logger.loading('Fetching completed points...');
  try {
    const response = await axiosWithRetry(
      'get',
      `${BASE_URL}/points?campaignId=${CAMPAIGN_ID}`,
      null,
      getAxiosConfig(AUTH_TOKEN, COOKIES)
    );
    logger.success(`Fetched ${response.data.length} completed points.`);
    return new Set(response.data.map(item => item.task_id));
  } catch (error) {
    logger.error(`Error fetching completed points: ${error.response?.data?.message || error.message}`);
    return new Set();
  }
}

async function fetchCompletedGems(AUTH_TOKEN, COOKIES) {
  logger.loading('Fetching completed gems...');
  try {
    const response = await axiosWithRetry(
      'get',
      `${BASE_URL}/gems?campaignId=${CAMPAIGN_ID}`,
      null,
      getAxiosConfig(AUTH_TOKEN, COOKIES)
    );
    logger.success(`Fetched ${response.data.length} completed gems.`);
    return new Set(response.data.map(item => item.task_id));
  } catch (error) {
    logger.error(`Error fetching completed gems: ${error.response?.data?.message || error.message}`);
    return new Set();
  }
}

async function fetchTasks(AUTH_TOKEN, COOKIES) {
  logger.loading('Fetching all tasks...');
  try {
    const response = await axiosWithRetry(
      'get',
      `${BASE_URL}/campaigns/${CAMPAIGN_ID}/tasks`,
      null,
      getAxiosConfig(AUTH_TOKEN, COOKIES)
    );
    logger.success(`Fetched ${response.data.length} tasks.`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching tasks: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

async function completeTask(taskId, taskTitle, AUTH_TOKEN, COOKIES) {
  logger.step(`Attempting to complete task: ${taskTitle} (ID: ${taskId})`);
  try {
    const pointsResponse = await axiosWithRetry(
      'post',
      `${BASE_URL}/points/add`,
      { taskId },
      getAxiosConfig(AUTH_TOKEN, COOKIES)
    );
    logger.info(`Points added for task ${taskTitle} (ID: ${taskId}): ${pointsResponse.data.points} points`);

    const gemsResponse = await axiosWithRetry(
      'post',
      `${BASE_URL}/gems/credit`,
      {
        transactionType: 'TASK',
        options: { taskId }
      },
      getAxiosConfig(AUTH_TOKEN, COOKIES)
    );
    logger.info(`Gems credited for task ${taskTitle} (ID: ${taskId}): ${gemsResponse.data.credit} gems`);

    return true;
  } catch (error) {
    logger.error(`Error completing task ${taskTitle} (ID: ${taskId}): ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function processTasksForAccount(account, accountIdx) {
  logger.banner(accountIdx);

  const AUTH_TOKEN = account.AUTH_TOKEN;
  const COOKIES = account.COOKIES;

  if (!AUTH_TOKEN || !COOKIES) {
    logger.error('AUTH_TOKEN or COOKIES missing for this account.');
    return;
  }

  const completedPoints = await fetchCompletedPoints(AUTH_TOKEN, COOKIES);
  const completedGems = await fetchCompletedGems(AUTH_TOKEN, COOKIES);
  logger.info(`Found ${completedPoints.size} tasks with points and ${completedGems.size} tasks with gems.`);

  const tasks = await fetchTasks(AUTH_TOKEN, COOKIES);

  if (!tasks.length) {
    logger.warn('No tasks found.');
    return;
  }

  for (const task of tasks) {
    if (!completedPoints.has(task.id) || !completedGems.has(task.id)) {
      const success = await completeTask(task.id, task.title, AUTH_TOKEN, COOKIES);

      if (success) {
        logger.success(`Task ${task.title} completed successfully.`);
      } else {
        logger.error(`Failed to complete task ${task.title}.`);
      }
    } else {
      logger.info(`Task ${task.title} (ID: ${task.id}) already completed. Skipping.`);
    }

    if (task.subtasks && task.subtasks.length > 0) {
      logger.info(`Found ${task.subtasks.length} subtasks for ${task.title}.`);
      for (const subtask of task.subtasks) {
        if (!completedPoints.has(subtask.id) || !completedGems.has(subtask.id)) {
          const success = await completeTask(subtask.id, subtask.title, AUTH_TOKEN, COOKIES);

          if (success) {
            logger.success(`Subtask ${subtask.title} completed successfully.`);
          } else {
            logger.error(`Failed to complete subtask ${subtask.title}.`);
          }
        } else {
          logger.info(`Subtask ${subtask.title} (ID: ${subtask.id}) already completed. Skipping.`);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.success(`All tasks and subtasks processed for account #${accountIdx + 1}.`);
}

async function main() {
  for (let i = 0; i < accounts.length; i++) {
    logger.info(`===============================`);
    logger.info(`Processing Account #${i + 1}`);
    logger.info(`===============================`);
    try {
      await processTasksForAccount(accounts[i], i);
    } catch (e) {
      logger.error(`Error processing account #${i + 1}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 3000)); // Delay between accounts
  }
}

main();
