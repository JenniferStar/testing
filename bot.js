const fs = require('fs');
const Card = require('./Card.json');
const emtpyCard = require('./Card.json');
const { exec } = require("child_process");
const { ActivityHandler, MessageFactory, TurnContext, CardFactory } = require('botbuilder');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { htmlToText } = require('html-to-text');

class EchoBot extends ActivityHandler {
    constructor(conversationReferences) {
        super();
        
        //Used for proactive message
        this.conversationReferences = conversationReferences;
        this.onConversationUpdate(async (context, next) => {
            this.addConversationReference(context.activity);
            await next();
        });

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            this.addConversationReference(context.activity);
           
            var data = "";
            var joburl = "";
            var newdata = ""; 
            var jobname = ""; 
            var jobnumber = "";
            var editeddata = "";
            var messageText = "";
            var lineRemove = 0;
            var amtRem = 0;
            var adapter = context.adapter;
            var inject = true;
           
            data = fs.readFileSync('link.txt', "utf8");

            //Checks for if the message is from the card or command
            if(context.activity.hasOwnProperty('text')){
                messageText = context.activity.text;
                messageText = messageText.replace(" ", "");
                messageText = messageText.replace("\n", "");
                messageText = messageText.replace("\r", "");
                messageText = messageText.replace(/<[^>]+>/g, '');
                messageText = htmlToText(messageText);

                //Shows all active job
                if(messageText === "showlist" || messageText === "Showlist" ){
                    setTimeout(async function(){
                        for (const conversationReference of Object.values(conversationReferences)) {
                            await adapter.continueConversation(conversationReference, async turnContext => {
                                await turnContext.sendActivity(data); 
                            });
                        }}, 5000);
                    
                    await next();

                //shows all commands
                }else if(messageText === "commandlist" || messageText === "Commandlist"){
                    await context.sendActivity("Command list:\n" + " - clear list\n" + " - show list\n" + " - build (job name)\n" + " - status (job link)");
                    await next();

                //clears the list of links 
                }else if(messageText === "clearlist" || messageText === "Clearlist"){
                    fs.writeFileSync('link.txt', "Links To Be Approved:\n", 'utf-8');
                    await context.sendActivity("List has been cleared.");
                    await next();

                //builds job with url
                }else if(messageText.substring(0, 5) === "build" || messageText.substring(0, 5) === "Build"){
                    joburl = messageText.substring(5, messageText.length);
                    
                    fs.writeFileSync('job_next.txt',joburl + "{}", 'utf8');

                    await context.sendActivity({
                        attachments: [CardFactory.adaptiveCard(Card)]
                    });
                    await next();
                    
                    
                //gets approve message
                }else if(messageText.substring(0, 7) === "approve" || messageText.substring(0, 5) === "Approve"){
                    jobname = messageText.substring(7, messageText.length);
                    
                    //checks for job name
                    var data2 = data.substring(data.indexOf(jobname), data.length);
                    if(data.indexOf(jobname) != -1 && data2.substring(0, data2.indexOf("BUILD NUMBER") - 5) === jobname){
                        joburl = data2.substring(data2.indexOf("JOB URL:") + 9, data2.length);

                        jobnumber = data2.substring(data2.indexOf("BUILD NUMBER") + 14, data2.indexOf("JOB URL:") - 5);

                        //Checks if its the last job on the list
                        if(joburl.indexOf("JOB NAME:") != -1){
                            joburl = joburl.substring(0, joburl.indexOf("JOB NAME:") - 5);
                        }

                        //sends card for user to sign into
                        await context.sendActivity({
                            attachments: [CardFactory.adaptiveCard(Card)]
                        });

                        //gets the job name and URL for text file
                        joburl = joburl.replace("\n", "");
                        fs.writeFileSync('job_next.txt', jobname + " ^ " + joburl + " ! " + jobnumber, 'utf8');
        
                        await next();

                    }else{
                        //job doesnt exsists
                        await context.sendActivity(`'${jobname}' could not be found.`);
                        await next();
                    }
                

                //gets the status of job send card for info.
                }else if(messageText.substring(0, 6) === "status" || messageText.substring(0, 6) === "Status"){
                    joburl = messageText.substring(6, messageText.length);
                    fs.writeFileSync('job_next.txt',joburl, 'utf8');

                    await context.sendActivity({
                        attachments: [CardFactory.adaptiveCard(Card)]
                    });
                    await next();

                }else{
                    //not a command
                    await context.sendActivity(`'${ messageText }' is not a command, use command list to see all commands.`);
                    await next();
                }
            }else{
                //card submitted for post either status, build, or approve
                var userinput = context.activity.value.name;
                var usertoken = context.activity.value.token;

                var symbols = ['-', '$', '@', '?', '\\', '\'', '\"', '!', '#', '%', '^', '&', '*', '(', ')', '=', '+', ':', ';', '.', ','];
                
                for(var i = 0; i < symbols.length; i++){
                    if(userinput.indexOf(symbols[i]) != -1){
                        inject = false;
                        i += 20;
                    }
                }

                for(var j = 0; j < symbols.length; j++){
                    if(usertoken.indexOf(symbols[j]) != -1){
                        inject = false;
                        i += 20;
                    }
                }

                joburl = fs.readFileSync('job_next.txt', 'utf8');

                //checks for any bad characters
                if(inject){

                    //build has {}, approve has ^ !, and status is plain link
                    if(joburl.indexOf("^") == -1 && joburl.indexOf("{}") == -1){
                        joburl = joburl.trim();    
                        var url = `${joburl}lastBuild/api/json`;

                        //gets last build status
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", url, true, userinput, usertoken);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = async function () {
                            if (xhr.readyState === 4) {
                                for (const conversationReference of Object.values(conversationReferences)) {
                                    await adapter.continueConversation(conversationReference, async turnContext => {
                                        var stdout = xhr.responseText;
                                        if(stdout.indexOf("Started by user") == -1 || stdout.indexOf("userId") == -1 || stdout.indexOf("result") == -1 || stdout.indexOf("timestamp") == -1){
                                            await turnContext.sendActivity("Status not found.");
                                        }else{
                                            var timedid = new Date(parseInt(stdout.substring(stdout.indexOf("\"timestamp\"") + 12, stdout.indexOf("\"url\"") - 1))).toLocaleString();
                                            var timetake = (parseInt(stdout.substring(stdout.indexOf("\"duration\"") + 11, stdout.indexOf("\"estimatedDuration\"") - 1)))/1000;

                                            await turnContext.sendActivity("Job Name: " + stdout.substring(stdout.indexOf("\"fullDisplayName\"") + 19, stdout.indexOf("\"id\"") - 2) + "\n\n" +
                                                                        "Started by: " + stdout.substring(stdout.indexOf("\"Started by user") + 16, stdout.indexOf("\"userId\"") - 2) + "\n\n" +
                                                                        "User ID: "+ stdout.substring(stdout.indexOf("\"userId\"") + 10, stdout.indexOf("\"userName\"") - 2) + "\n\n" +
                                                                        "Timestamp: "+ timedid + "\n\n" +
                                                                        "Duration: " + timetake + " sec\n\n" +
                                                                        "Build Status: " + stdout.substring(stdout.indexOf("\"result\"") + 10, stdout.indexOf("\"timestamp\"") - 2));
                                        }
                                    });
                                }
                            }
                        };
                        
                        xhr.send();
                        fs.writeFileSync('job_next.txt', "", 'utf8');
                    
                    //sends build request
                    }else if(joburl.indexOf("{}") != -1){
                        joburl = joburl.trim(); 
                        joburl = joburl.substring(0, joburl.length - 2);
                        var url = `${joburl}build`;

                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", url, true, userinput, usertoken);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = async function () {
                            if (xhr.readyState === 4) {
                                if(xhr.status != "201" && xhr.status != "200"){
                                    for (const conversationReference of Object.values(conversationReferences)) {
                                        await adapter.continueConversation(conversationReference, async turnContext => {
                                            await turnContext.sendActivity("Request not approved."+"\n\n"+"Incorrect username or token.");
                                            fs.writeFileSync('job_next.txt', "", 'utf8');
                                        });
                                    }
                                }else{
                                    for (const conversationReference of Object.values(conversationReferences)) {
                                        await adapter.continueConversation(conversationReference, async turnContext => {
                                            await turnContext.sendActivity(`Build request has been sent.`);
                                        });
                                    }
                                }
                            }
                        }
                        xhr.send();
                    
                    //approve build
                    }else{
                        jobname = joburl.substring(0, joburl.indexOf("^") - 1);
                        jobnumber = joburl.substring(joburl.indexOf("!") + 2, joburl.length);
                        joburl = joburl.substring(joburl.indexOf("^") + 2, joburl.indexOf("!") - 1);
                        
                        //gets input id
                        var url = `${joburl}${jobnumber}/wfapi/pendingInputActions/`;

                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", url, true, userinput, usertoken);
                        xhr.withCredentials = true;
                        xhr.onreadystatechange = async function () {
                            if (xhr.readyState === 4) {
                                if(xhr.status != "201" && xhr.status != "200"){
                                    for (const conversationReference of Object.values(conversationReferences)) {
                                        await adapter.continueConversation(conversationReference, async turnContext => {
                                            await turnContext.sendActivity("Request not approved."+"\n\n"+"Incorrect username or token.");
                                            fs.writeFileSync('job_next.txt', "", 'utf8');
                                        });
                                    }
                                }else{
                                    var stdout = xhr.responseText;
                                    var id = "";

                                    //gets id from output and passes proceed request
                                    id = stdout.substring(stdout.indexOf("\"id\"")+6, stdout.indexOf("\"proceedText\"")-2);
                                    url = `${joburl}${jobnumber}/input/${id}/proceedEmpty`;

                                    xhr = new XMLHttpRequest();
                                    xhr.open("POST", url, true, userinput, usertoken);
                                    xhr.withCredentials = true;
                                    xhr.onreadystatechange = async function () {
                                        if (xhr.readyState === 4) {
                                            if(xhr.status != "201" && xhr.status != "200"){
                                                for (const conversationReference of Object.values(conversationReferences)) {
                                                    await adapter.continueConversation(conversationReference, async turnContext => {
                                                        await turnContext.sendActivity("Request not approved."+"\n\n"+"Incorrect username or token.");
                                                        fs.writeFileSync('job_next.txt', "", 'utf8');
                                                    });
                                                }
                                            }else{
                                                //removes approved link from list
                                                amtRem = 0;
                                                editeddata = data.split('\n');
                                                lineRemove = lineFinder(editeddata, jobname);

                                                while(amtRem < 6){
                                                    editeddata.splice(lineRemove, 1);
                                                    amtRem++;
                                                }

                                                for(var i = 0; i < editeddata.length - 1; i++){
                                                    newdata = newdata + editeddata[i] + "\n";
                                                }
                                                        
                                                //puts new list into file
                                                fs.writeFileSync('link.txt', newdata, 'utf-8');
                                    
                                                fs.writeFileSync('job_next.txt', "", 'utf8');

                                                for (const conversationReference of Object.values(conversationReferences)) {
                                                    await adapter.continueConversation(conversationReference, async turnContext => {
                                                        await turnContext.sendActivity(`${jobname} has been approved.`);
                                                    });
                                                }
                                            }       
                                        }
                                    }
                                    xhr.send();
                                }
                            }
                        }
                        xhr.send();
                    }
                }else{
                    await context.sendActivity("Illegal Character Usage.");
                    fs.writeFileSync('job_next.txt', "", 'utf8');
                }

                    await next();
            }
        });

        //sends first message when chat opened
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

    //gives proactive message refernce
    addConversationReference(activity) {
        const conversationReference = TurnContext.getConversationReference(activity);
        this.conversationReferences[conversationReference.conversation.id] = conversationReference;
    }
}

//finds which line the job is on in file
function lineFinder(array, jobname){
    for(var i = 0; i < array.length; i++){
        if((" - JOB NAME:  " + jobname) === array[i]){
            return i;
        }
    }
}

module.exports.EchoBot = EchoBot;
