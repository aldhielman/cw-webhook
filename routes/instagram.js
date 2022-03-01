var express = require("express");
var router = express.Router();
const axios = require("axios");
const mysql = require('mysql')


var mysqlConnection = mysql.createConnection({
    host: 'localhost',
    user: 'administrator',
    password: '@dminBC!',
    database: 'ig_cw_webhook',
    multipleStatements: true
});

mysqlConnection.connect((err) => {
    if (!err)
        console.log('Connection Established Successfully');
    else
        console.log('Connection Failed!' + JSON.stringify(err, undefined, 2));
});

// CONFIG
const IG_GRAPH_URL = "https://graph.facebook.com/v12.0";
const IG_ACCESS_TOKEN =
    "EAAKIPQ8DwfIBANVByvsO8geIZAjwbpDIDLFTYcNhZAVuikVAdk0Ih6jpueTOxZCJPdeVpe8n6ONM32o25A2dZCh01IY80qLbHcPs5g6UnaqD4Ab8nrgWMZC34Ll3sfy1yvVmpr2yhPDtfcIlwTt3ZAtrv1mXHRGkoUG0MSZBEcjR8jRoc5zCsLXuc8lgxUHoxAZD";
const MY_IG_ID = "17841451744252101";

const CW_BASE_URL = "https://cw.bcperak.net";
const CW_INBOX_IDENTIFIER = "U5ozNEbVVFhFiM7VuVqrg56V";
const CW_FULL_PATH = `${CW_BASE_URL}/public/api/v1/inboxes/${CW_INBOX_IDENTIFIER}`;

/* instagram verification */
router.get("/", function (req, res, next) {
    res.send(req.query["hub.challenge"]);
});

router.post("/", function (req, res, next) {

    const payload = req.body;
    const { entry } = payload;

    const messagging = entry[0].messaging ?? null
    if (messagging) {
        const message = messagging[0].message ?? null;

        if (message) {
            const { sender } = messagging[0];
            if (sender.id != MY_IG_ID) {
                var isStoryMention = false;

                const attachments = message.attachments ?? null;
                if (attachments) {
                    // check story mention or not
                    if (attachments[0].type == "story_mention") isStoryMention = true;
                }

                // check create / deleted message
                const isDeleted = message.is_deleted ?? null


                forwardToChatwoot(payload, isStoryMention, isDeleted);
            }
        }
    }


    res.send("ok");

});

const forwardToChatwoot = async (payload, isStoryMention, isDeleted) => {

    const source_id = await ChatwootCreateOrUpdateContact(payload);
    const conversation_id = await ChatwootGetConversation(source_id);
    const endPoint = `${CW_FULL_PATH}/contacts/${source_id}/conversations/${conversation_id}/messages`;
    console.log(endPoint)
    const mid = payload.entry[0].messaging[0].message.mid;

    if (!isDeleted) {

        var message
        // // TODO CHEK IS STORY OR DM HERE
        if (isStoryMention) {

            const content =
                payload.entry[0].messaging[0].message.attachments[0].payload.url;

            await axios.post(endPoint, { content: "I've tagged Instagram Story on you, Let's Checkout link bellow" });
            message = await axios.post(endPoint, { content });

        } else {
            console.log(endPoint)
            const content = payload.entry[0].messaging[0].message.text;
            message = await axios.post(endPoint, { content });
        }

        // store to db
        mysqlConnection.query(`INSERT INTO message_map  VALUES ('${message.data.id}','${mid}')`, (err, result) => {
            if (err) throw err
        })
    }

    else {
        // get cw_message_id from db
        mysqlConnection.query(`SELECT cw_message_id FROM message_map WHERE ig_message_id = '${mid}' LIMIT 1`, (err, result) => {
            var cw_id = parseInt(result[0].cw_message_id)
            const DELETE_URL = `https://cw.bcperak.net/api/v1/accounts/1/conversations/${conversation_id}/messages`

            axios.delete(`${DELETE_URL}/${cw_id}`, {
                headers: {
                    "api-access-token": "mpyq6fn9gGQgHhmFV1o5Vtz4"
                }
            })

            if (isStoryMention) {

                axios.delete(`${DELETE_URL}/${cw_id}`, {
                    headers: {
                        "api-access-token": "mpyq6fn9gGQgHhmFV1o5Vtz4"
                    }
                })
            }
        })
    }

};

const getInstagramProfile = async (IGSID) => {
    return await axios
        .get(`${IG_GRAPH_URL}/${IGSID}`, {
            params: {
                access_token: IG_ACCESS_TOKEN,
            },
        })
        .then((res) => res.data);
};

const getChatwootContact = async (source_id) => {
    const endPoint = `${CW_FULL_PATH}/contacts`;

    return await axios
        .get(`${endPoint}/${source_id}`)
        .then((res) => res.data)
        .catch((err) => {
            return false;
        });
};

const ChatwootCreateOrUpdateContact = async (payload) => {
    const IGSID = payload.entry[0].messaging[0].sender.id;
    const source_id = IGSID;

    //   get username
    const igProfile = await getInstagramProfile(IGSID).catch(err => console.log(err.data));

    //   endpoint create contact
    const endPoint = `${CW_FULL_PATH}/contacts`;

    //   check contact exist
    const chatwootContact = await getChatwootContact(source_id);
    if (chatwootContact) {
        // update
        axios
            .patch(`${endPoint}/${source_id}`, { name: igProfile.name })
            .then(function (response) {
                return response.data.source_id;
            });
        return source_id;
    } else {
        // create
        return await axios
            .post(`${endPoint}`, { source_id, name: igProfile.name })
            .then(function (response) {
                return response.data.source_id;
            });
    }
};

const ChatwootGetConversation = async (source_id) => {
    const endPoint = `${CW_FULL_PATH}/contacts/${source_id}/conversations`;
    console.log("here")
    const data = await axios
        .get(`${endPoint}`)
        .then(function (response) {
            return response.data;
        })
        .catch(function (error) {
            return error.response.data;
        });

    if (data.length > 0) {
        // TO DO
        // CALL NON PUBLIC API CHATWOOT TO TOOGLE STATUS BACK TO PENDING FIRST
        // to initiate new session when conv alreade mark as resolve
        if (data.status == "resolved") {
            // patch status field
        }
        return data[0].id;
    } else {
        // create
        // need replacement to name fields grab from ig profile webhhok
        return await axios.post(endPoint).then(function (response) {
            return response.data.id;
        });
    }
};

module.exports = router;
