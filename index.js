const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const restify = require('restify');
const { EchoBot } = require('./bot');
const ENV_FILE = path.join(__dirname, '.env');
const { BotFrameworkAdapter } = require('botbuilder');

dotenv.config({ path: ENV_FILE });

const conversationReferences = {};
const myBot = new EchoBot(conversationReferences);

// Create HTTP server
const server = restify.createServer();
const adapter = new BotFrameworkAdapter({});

//Listens to port 3978
server.listen(process.env.port || process.env.PORT || 3978, () => {
  
});

// Catch-all for errors.
const onTurnErrorHandler = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${ error }`);
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );
    await context.sendActivity('The bot encountered an error or bug.');
    await context.sendActivity('To continue to run this bot, please fix the bot source code.');
};
adapter.onTurnError = onTurnErrorHandler;

//API for messages
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await myBot.run(context);
    });
});

//Captures email and parses information
server.use(restify.plugins.bodyParser());

server.post('/api/data', async (req, res) => {
    for (const conversationReference of Object.values(conversationReferences)) {
        await adapter.continueConversation(conversationReference, async turnContext => {
            await turnContext.sendActivity(req.body);

            //Formats the email and puts into text d
            let bodyText = req.body;
            let jobname = "";
            let joburl = "";

            jobname = bodyText.substring(bodyText.indexOf("JOB NAME:")+10, bodyText.indexOf("JOB URL:"));
            jobname = jobname.replace(/\n/g, '');
            jobname = jobname.substring(3, jobname.length);

            joburl = bodyText.substring(bodyText.indexOf("JOB URL:")+9, bodyText.length);
            joburl = joburl.replace(/\n/g, '');

            linkFile("JOB NAME: " + jobname + "\n\n   JOB URL: "+ joburl);
        });
    }
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end();
});
  
//Adds links to link
function linkFile(linkText){
    fs.appendFile('link.txt', "\n - " + linkText + "\n", (err)=>{
        if(err) throw(err);
    });
}
