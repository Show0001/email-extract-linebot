const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json()); // ← 重要：JSONパースミドルウェア

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

// メールアドレス抽出関数
function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

// Webhook受信
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
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

      const replyText = emails.length
        ? `見つかったメールアドレス:\n${emails.join('\n')}`
        : 'メールアドレスが見つかりませんでした。';

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
      });
    }));

    res.status(200).send('OK');
  } catch (err) {
    console.error('エラー:', err);
    res.status(500).send('Error');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ LINE Bot running on ${port}`));
