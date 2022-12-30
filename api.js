require('dotenv').config();
const axios = require('axios');

const twitch = axios.create({
  baseURL: 'https://api.twitch.tv/helix',
});

const clientId = process.env.TWITCH_ID;
const clientSecret = process.env.TWITCH_SECRET;

let token = null;
let ratelimit_limit = 800;
let ratelimit_remaining = ratelimit_limit;
let ratelimit_reset;

const bucketReset = (reset) => {
  clearTimeout(ratelimit_reset);
  ratelimit_reset = setTimeout(() => {
    ratelimit_remaining = ratelimit_limit;
  }, Number(reset) * 1000 - Date.now());
};

const getToken = async () => {
  const res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
  token = `Bearer ${res.data.access_token}`;
};

twitch.interceptors.request.use(async (config) => {
  if (ratelimit_remaining <= 0) {
    throw new Error('429 RateLimited');
  }
  ratelimit_remaining -= 1;
  try {
    if (!token) {
      // Don't even bother checking cause we don't have a token
      throw new Error('Missing Token');
    }
    await axios.head('https://id.twitch.tv/oauth2/validate', {
      headers: {
        Authorization: token,
      }
    });
  }
  catch (error) {
    await getToken();
  }
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: token,
      'Client-ID': clientId,
    }
  }
}, (error) => {
  Promise.reject(error);
});

twitch.interceptors.response.use((response) => {
  // Any status code that lie within the range of 2xx cause this function to trigger
  // Do something with response data
  const { headers } = response;
  ratelimit_limit = headers['ratelimit-limit'];
  ratelimit_remaining = headers['ratelimit-remaining'];
  bucketReset(headers['ratelimit-reset']);
  return response;
}, (error) => {
  // Any status codes that falls outside the range of 2xx cause this function to trigger
  // Do something with response error
  const { headers } = error.response;
  ratelimit_limit = headers['ratelimit-limit'];
  ratelimit_remaining = headers['ratelimit-remaining'];
  bucketReset(headers['ratelimit-reset']);
  if (error.response.status === 429) {
    ratelimit_remaining = -1;
  }
  return Promise.reject(error);
  });

module.exports = twitch;