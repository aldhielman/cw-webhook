var express = require("express");
var router = express.Router();
const axios = require("axios");

// config
const IG_GRAPH_URL = "https://graph.facebook.com/v12.0";
const IG_SEND_MESSAGE_URL = `${IG_GRAPH_URL}/me/messages`;
const IG_ACCESS_TOKEN =
    "EAAKIPQ8DwfIBANVByvsO8geIZAjwbpDIDLFTYcNhZAVuikVAdk0Ih6jpueTOxZCJPdeVpe8n6ONM32o25A2dZCh01IY80qLbHcPs5g6UnaqD4Ab8nrgWMZC34Ll3sfy1yvVmpr2yhPDtfcIlwTt3ZAtrv1mXHRGkoUG0MSZBEcjR8jRoc5zCsLXuc8lgxUHoxAZD";

router.post("/", function (req, res, next) {
    if (
        req.body.event == "message_created" &&
        req.body.inbox.name == "IG" &&
        req.body.message_type == "outgoing"
    ) {
        console.log("process");
        const igsid = req.body.conversation.contact_inbox.source_id;
        const text = req.body.content;
        const payload = {
            recipient: {
                id: igsid,
            },
            message: {
                text: text,
            },
        };
        axios.post(IG_SEND_MESSAGE_URL, payload, {
            params: {
                access_token: IG_ACCESS_TOKEN,
            },
        });
    }
    res.sendStatus(200);
});

module.exports = router;
