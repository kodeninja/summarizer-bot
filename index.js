/////////////////////////////////////////////////
var fs = require("fs");
var gcloud_app_creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if(gcloud_app_creds) {
    console.log("Writing gcloud creds to tmp file...");
    fs.writeFileSync("/tmp/summarizer-bot-a0f9b7bdb9df.json", gcloud_app_creds, "utf-8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/summarizer-bot-a0f9b7bdb9df.json";
    console.log("Enabling gcloud debug module...");
    require("@google/cloud-debug");
}
/////////////////////////////////////////////////

console.log("Starting bot...");

var Botkit = require("botkit"),
    request = require("request"),
    extractUrls = require("get-urls"),
    _ = require("lodash");

var token = process.env.SLACK_TOKEN,
    SM_API_KEY = process.env.SM_API_KEY;


var USERS = {};
    
var SUMMRY_ERROR_MAPPINGS = {
    "0": "Internal server problem which isn't your fault",
    "1": "Incorrect submission variables",
    "2": "Intentional restriction (low credits/disabled API key/banned API key)",
    "3": "Summarization error"
};

var controller = Botkit.slackbot({
  // reconnect to Slack RTM when connection goes bad
  retry: Infinity,
  debug: false
});

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
  console.log("Starting in single-team mode");
  controller.spawn({
    token: token
  }).startRTM(function (err, bot, payload) {
    if (err) {
      throw new Error(err);
    }

    console.log("Connected to Slack RTM");
  });
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
  console.log("Starting in Beep Boop multi-team mode");
  require("beepboop-botkit").start(controller, { debug: true });
}

controller.on("bot_channel_join", function (bot, message) {
  bot.reply(message, "I'm here!");
});

controller.hears([".*"], ["mention", "direct_message", "direct_mention"], function(bot, message) {
    console.log("››››› Message received: %j", message);
    
    var userID = message.user;
    var userName = USERS[userID];
    if(userName) {
        replyToUser(bot, message, userName);
    } else {
        bot.api.users.info({user: userID}, function(err, info) {
            if(err) {
                console.log("Failed to fetch user info for user id: %s, with error: ", userID, err);
            } else {
                console.log("Found user info: %j", info);
                userName = "@" + info.user.name;
                USERS[userID] = userName;
            }
            replyToUser(bot, message, userName);
        });
    }
});

function replyToUser(bot, message, userName) {
    if(message.text) {
        var urls = extractUrls(message.text);
        if(Array.isArray(urls) && urls.length > 0) {
            // Pick the 1st url
            var urlToSummarize = urls[0];
            if(_.endsWith(urlToSummarize, ",")) {
                urlToSummarize = urlToSummarize.substring(0, urlToSummarize.lastIndexOf(","));
            }
            if(_.endsWith(urlToSummarize, ">")) {
                urlToSummarize = urlToSummarize.substring(0, urlToSummarize.lastIndexOf(">"));
            }
            if(_.endsWith(urlToSummarize, "%3E")) {
                urlToSummarize = urlToSummarize.substring(0, urlToSummarize.lastIndexOf("%3E"));
            }
            console.log("Trying to summarize: %s", urlToSummarize);
            var smmryUrl = "http://api.smmry.com?SM_API_KEY=" + SM_API_KEY + "&SM_LENGTH=3" + "&SM_WITH_BREAK" + "&SM_KEYWORD_COUNT=5" + "&SM_URL="+urlToSummarize;
            request.get({url: smmryUrl, json: true}, function(err, response, body) {
                if(err || body.hasOwnProperty("sm_api_error")) {
                    if(err) {
                        console.log(err);
                    }
                    if(body.hasOwnProperty("sm_api_error")) {
                        console.log("An error occurred: %s -> %s", SUMMRY_ERROR_MAPPINGS[""+body.sm_api_error], body.sm_api_message);
                    }
                    
                    // console.log("%s", require("util").inspect(message, false, 4, false));
                    return bot.reply(message, "I'm sorry," + (userName ? (" " + userName + ", ") :"") +"but I could not summarize this :disappointed:.");
                }
                
                var charCount = body.sm_api_character_count,
                    title = body.sm_api_title,
                    summary = body.sm_api_content,
                    keywords = body.sm_api_keyword_array;
                
                summary = "*Summary*:\n" + "• " + summary.split("[BREAK]").filter(Boolean).join("\n•").trim();
                
                var keywordsAndSummary = "";
                if(Array.isArray(keywords) && keywords.length > 0) {
                    keywordsAndSummary = "*Keywords*:\n" + keywords.map(function(k) {
                        return "`" + k.toLowerCase() + "`";
                    }).join(", ");
                    keywordsAndSummary += "\n" + summary;
                } else {
                    keywordsAndSummary = summary;
                }

                console.log("››››› Sending summary: %s", keywordsAndSummary);
                bot.reply(message, keywordsAndSummary);
            });
        }
    }
}

controller.hears(["hello", "hi"], ["direct_mention"], function (bot, message) {
  bot.reply(message, "Hello.");
})

controller.hears(["hello", "hi"], ["direct_message"], function (bot, message) {
  bot.reply(message, "Hello.");
  bot.reply(message, "It's nice to talk to you directly.");
})

// controller.hears('.*', ['mention'], function (bot, message) {
//   bot.reply(message, 'Awwe, you really _do_ care about me. :heart:')
// })

controller.hears("help", ["direct_message", "direct_mention"], function (bot, message) {
  var help = "I will respond to the following messages: \n" +
      "`bot hi` for a simple message.\n" +
      "`bot attachment` to see a Slack attachment message.\n" +
      "`@<your bot\'s name>` to demonstrate detecting a mention.\n" +
      "`bot help` to see this again.";
  bot.reply(message, help);
})

controller.hears(["attachment"], ["direct_message", "direct_mention"], function (bot, message) {
  var text = "Beep Beep Boop is a ridiculously simple hosting platform for your Slackbots.";
  var attachments = [{
    fallback: text,
    pretext: "We bring bots to life. :sunglasses: :thumbsup:",
    title: "Host, deploy and share your bot in seconds.",
    image_url: "https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png",
    title_link: "https://beepboophq.com/",
    text: text,
    color: "#7CD197"
  }];

  bot.reply(message, {
    attachments: attachments
  }, function (err, resp) {
    console.log(err, resp)
  });
})

// controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
//   bot.reply(message, 'Sorry <@' + message.user + '>, I don\'t understand. \n')
// })
