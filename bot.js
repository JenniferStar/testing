const fs = require('fs');
const Card = require('./Card.json');
const { exec } = require("child_process");
const { ActivityHandler, MessageFactory, TurnContext, CardFactory, TurnContextStateCollection  } = require('botbuilder');

class EchoBot extends ActivityHandler {
    constructor(conversationReferences) {
        super();

        this.conversationReferences = conversationReferences;

        this.onConversationUpdate(async (context, next) => {
            this.addConversationReference(context.activity);

            await next();
        });

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            this.addConversationReference(context.activity);
            
            var newdata = "";
            var editeddata = "";
            var messageText = "";
            var data = "";
            var job_next = "";
            var lineRemove = 0;
            var errorHap = 0;
            var errorRep = "";
            var amtRem = 0;
            var jobname = "";
            var joburl = "";
            
            
            data = fs.readFileSync('link.txt', "utf8");
            job_next = fs.readFileSync('job_next.txt', 'utf8');

            if(context.activity.hasOwnProperty('text')){
                messageText = context.activity.text;

            if(messageText === "show list"){

                await context.sendActivity(data);
                await next();
            
            }else if(messageText === "command list"){
                await context.sendActivity("Command list:\n"+
                                            " - show list\n"+
                                            " - approve (job name)");
                await next();

            }else if(messageText.substring(0, 7) === "approve"){
                jobname = messageText.substring(8, messageText.length);
                if(data.indexOf(jobname) != -1){
                    joburl = data.substring(data.indexOf("JOB URL:", data.indexOf(jobname)) + 9, data.length);
                    if(joburl.indexOf("JOB NAME:") != -1){
                        joburl = joburl.substring(0, joburl.indexOf("JOB NAME:") - 6);
                    }
                    
                    fs.writeFileSync('job_next.txt', jobname + "  ^ " + joburl, 'utf8');

                    editeddata = data.split('\n');
                    lineRemove = lineFinder(editeddata, jobname);
                    while(amtRem < 4){
                        editeddata.splice(lineRemove, 1);
                        amtRem++;
                    }
                    
                    for(var i = 0; i < editeddata.length; i++){
                        newdata = newdata + editeddata[i] + "\n";
                    }

                    fs.writeFileSync('link.txt', newdata, 'utf-8');

                    await context.sendActivity({
                        jobtext:`${jobname}`,
                        attachments: [CardFactory.adaptiveCard(Card)]
                    });
    
                    await next();

                }else{
                    await context.sendActivity(`'${jobname}' could not be found.`);
                    await next();
                }
            }else{
                await context.sendActivity(`'${ messageText }' is not a command, use command list to see all commands.`);
                await next();
            }
        }else{
            joburl = fs.readFileSync('job_next.txt', 'utf8');
            exec(`curl -X POST -u ${context.activity.value.name}:${context.activity.value.token} ${joburl.substring(joburl.indexOf("^")+1, joburl.length)}/build/`, (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    return;
                }
                console.log(`stdout: ${stdout}`);
            });

            fs.writeFileSync('job_next.txt', "", 'utf8');

            await context.sendActivity(`${joburl.substring(0, joburl.indexOf("^")-1)} has been built.`);
            await next();
        }
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = 'Hello, use \'command list\' to see commands.';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            await next();
        });
    }

    addConversationReference(activity) {
        const conversationReference = TurnContext.getConversationReference(activity);
        this.conversationReferences[conversationReference.conversation.id] = conversationReference;
    }
}

function lineFinder(array, jobname){
    for(var i = 0; i < array.length; i++){
        if((" - JOB NAME: " + jobname) === array[i]){
            return i;
        }
    }
}

module.exports.EchoBot = EchoBot;
