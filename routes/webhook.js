var express = require('express');
var router = express.Router();
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data')
const reequest = require('request')

// config

// Chatwoot API
const CW_BASE_URL = 'https://cw.bcperak.net';
const CW_INBOX_IDENTIFIER = "RXi1gsGC2CPcDKyBq3DJYeki";
const CW_FULL_PATH = `${CW_BASE_URL}/public/api/v1/inboxes/${CW_INBOX_IDENTIFIER}`

/* instagram verification */
router.get('/instagram', function (req, res, next) {
  res.send(req.query['hub.challenge'])
});

router.get('/test', async function (req, res, next) {

  const form = new FormData()

  await axios.get('https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=17946613321776406&signature=AbzcNl8xOU6OIANLbbQXf3hqqYM7OrscZPU6BsTB7uZS4AV7P2OD-A795CUmXMwJfFcyrrJ4qjxe4u9V71PEtRu3bgPgEBw9OjxcJLzcPNeUGXl3LWLIZuDWbpBiSzXMAQ8GWvXNMKi0hKLIZ9_JX2_sfMYi0ooVy6lKjigZXAmkJW64', {
    responseType: 'stream'
  }).then(async res => {
    await res.data.pipe(fs.createWriteStream('story.jpg'))
    console.log('axios')
  })
  console.log('outside')
  console.log(fs.existsSync('./story.jpg'))

  setTimeout(() => {
    form.append('attachments[]', fs.createReadStream('./story.jpg'));
    const url = "https://cw.bcperak.net/public/api/v1/inboxes/RXi1gsGC2CPcDKyBq3DJYeki/contacts/ig-4412814845485548/conversations/220/messages"
    axios.post(url, form, {
      headers: form.getHeaders()
    })
  }, 2000)


  res.send("ok")





})

router.post('/instagram', function (req, res, next) {

  const payload = req.body;

  // check story mention or not
  var isStoryMention = false;
  const attachments = payload.entry[0].messaging[0].message.attachments
  if (attachments) {
    if (attachments[0].type == "story_mention")
      isStoryMention = true;
  }

  forwardToChatwoot(payload, isStoryMention);
  res.sendStatus(200)

})

router.post('/chatwoot', function (req, res, next) {
  filePath = 'data-chatwoot.json'

  fs.appendFile(filePath, JSON.stringify(req.body), function (err) {
    if (err) { throw err }
    res.status(200).json({
      message: "File successfully written"
    })
  });

})

const forwardToChatwoot = async (payload, isStoryMention) => {

  const source_id = await ChatwootCreateOrUpdateContact(payload);

  const conversation_id = await ChatwootGetConversation(source_id);

  const endPoint = `${CW_FULL_PATH}/contacts/${source_id}/conversations/${conversation_id}/messages`;

  // // TODO CHEK IS STORY OR DM HERE 
  if (isStoryMention) {
    const form = new FormData()

    const storyUrl = payload.entry[0].messaging[0].message.attachments[0].payload.url

    await axios.get(storyUrl, {
      responseType: 'stream'
    }).then(async res => {
      await res.data.pipe(fs.createWriteStream('story.jpg'))
    })

    setTimeout(() => {
      form.append('attachments[]', fs.createReadStream('./story.jpg'));
      axios.post(endPoint, form, {
        headers: form.getHeaders()
      })
    }, 2000)

  }
  else {
    const content = payload.entry[0].messaging[0].message.text;
    await axios.post(endPoint, { content })
  }

}

const ChatwootCreateOrUpdateContact = async (payload) => {

  const source_id = `ig-${payload.entry[0].messaging[0].sender.id}`

  const endPoint = `${CW_FULL_PATH}/contacts`

  const data = await axios.get(`${endPoint}/${source_id}`)
    .then(function (response) {
      return response.data
    })
    .catch(function (error) {
      return error.response.data
    });


  if (data.source_id) {
    // update
    // need replacement to name fields grab from ig profile webhhok
    axios.patch(`${endPoint}/${data.source_id}`, { name: source_id })
      .then(function (response) {
        return response.data.source_id
      })
    return data.source_id

  }
  else {
    // create
    // need replacement to name fields grab from ig profile webhhok
    return await axios.post(`${endPoint}`, { source_id, name: source_id })
      .then(function (response) {
        return response.data.source_id
      })
  }

}

const ChatwootGetConversation = async (source_id) => {

  const endPoint = `${CW_FULL_PATH}/contacts/${source_id}/conversations`
  const data = await axios.get(`${endPoint}`)
    .then(function (response) {
      return response.data
    })
    .catch(function (error) {
      return error.response.data
    });

  if (data.length > 0) {
    // TO DO
    // CALL NON PUBLIC API CHATWOOT TO TOOGLE STATUS BACK TO PENDING FIRST
    // to initiate new session when conv alreade mark as resolve
    if (data.status == "resolved") {
      // patch status field
    }
    return data[0].id
  }
  else {
    // create
    // need replacement to name fields grab from ig profile webhhok
    return await axios.post(endPoint)
      .then(function (response) {
        return response.data.id
      })
  }
}
module.exports = router;
