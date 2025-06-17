const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const { extractEmails } = require('./utils');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;

  await Promise.all(events.map(async (event) => {
    if (event.type !== 'message' || event.message.type !== 'image') return;

    const messageId = event.message.id;
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const base64Image = Buffer.concat(chunks).toString('base64');

    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      }
    );

    const text = visionResponse.data.responses[0].fullTextAnnotation?.text || '';
    const emails = extractEmails(text);

    const replyText = emails.length ? `見つかったメールアドレス:
${emails.join('\n')}` : 'メールアドレスが見つかりませんでした。';
    await client.replyMessage(event.replyToken, { type: 'text', text: replyText });
  }));

  res.status(200).send('OK');
});

app.listen(port, () => console.log(`Server running on ${port}`));