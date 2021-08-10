Jenkins Bot, Takes in email from azure logic app, parse the email and then displays the information in the active chat.
User then will be able to approve jobs with user name and API token, this will launch a curl request.

Index.js file holds main server setup and messages recived, messages are passed to bot.js to be read and parsed.

Bot.js looks at messages sent and responsed back from a list of commands, show list, approve (job_name), command list.
