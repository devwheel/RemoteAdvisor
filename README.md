<h1>Integrating Video into your Applications with Azure Communication Services</h1>
<h2>Background</h2>
<p>I’ve done a lot of work with customers a couple of years ago promoting remote advisor scenarios utilizing API’s from the Skype for Business group. I was working with healthcare companies experimenting with Telemedicine solutions and other types of “remote advisor” scenarios such as premier financial service advisors. The team was in full speed ahead mode when it was abruptly announced that Skype for Business was getting merged into Microsoft Teams. This halted the completion of a lot of the work we were doing at the time. The truth be told, integrating these scenarios as stock solutions created complexities in the applications as the dependency for Skype for Business was required.</p>
<p>
Fast forward to 2021. Microsoft has announced a new service in Azure to provide the same capabilities as a stand-a-lone service as Azure Communication Services. Azure Communication Services support Chat, Telephony, SMS, Voice, and Video calling via JavaScript and there is an iOS and Android SDK. The goal of this article is to highlight the video calling service and walk you through some of the key APIs to add voice/video to your applications using JavaScript. I want to put my spin on this article, otherwise you can just walk through the SDK samples at Azure Communication Services - Samples. I felt the need to publish this article to bridge the gap that I faced as a traditional .Net developer. It seems everything at Microsoft these days is leveraging the React framework for front end development. Although it seems to be an elegant framework, I’m not proficient in it yet and following most of the samples is painful at best for me.
</p>
<h2>Getting Started</h2>
<p>
The first thing you will need to do is spin up an ACS instance in Azure.
</p>
<p>
Once you create the service, you will minimally need to setup your usage keys (primarily the connection string). So now we’re ready to roll!
</p>
<h2>Now the Code</h2>
<p>
I’m going to create a sample using the .Net Framework vs .Net Core as there are some samples that utilize .Net Core out there and it is my belief that there is still a lot of .Net Framework web applications out there that could easily use this article as a recipe for integration.
The illustration below documents the settings that I used to create the .Net Web Application. Note that I added Web API to the solution.
</p>
<p>
We also need to add nuget packages to support the project:
</p>
<ul>
<li>Install-Package Azure.Communication.Common -Version 1.0.0-beta.3</li>
<li>Install-Package Azure.Communication.Administration -Version 1.0.0-beta.3</li>
</ul>
<h3>Authentication</h3>
<p>
ACS allows you to create identities and manage your access tokens. The identities created do not contain any PII data so you would typically map that identity as a property of your application’s identity solution. For a real “quick start” there is a nice sample that implements this in an Azure function. We will go ahead and implement it as part of our solution so we will need a web API to do this.
</p>
<p>
I’m going to create 2 APIs for this. Below is the 2 APIs that I created for token management.  
</p>
<ul>
<li>The first API creates the user and gets a token for that new user.</li>
<li>The second API refreshes a token for a user that has an identity.</li>
</ul>
<p>
The returned tokenResponse will have a structure like:
</p>
{
"Token": "[The Token]",
"User": "[the ACS User]",
"ExpiresOn": "2021-01-08T03:40:02.5492449+00:00"
}
<p>
You would typically map the User property to your applications identity system.
</p>
<h3>Front End Code</h3>
<p>
The purpose of this part is not to be super glamorous. It is intended to for you to easily follow the flows to better understand the APIs. I will also include some of my findings about utilizing the JavaScript SDK in this section.
</p>
<h3>Getting Started with the code</h3>
<p>
In the code block below, there are a few notables:
<ul>
<li>The first thing we have to do is call our Web API to get a token from the ACS instance – In this sample, I’m using a facade for authentication so I’m using the Web API that will create a new user on each run. The CommunicationUserCredential is needed to create the CallAgent</li>
<li>CallClient instance is newed up and a request is made to ACS for an ACS user credential – The CallClient is the main entry point to the Calling client library</li>
<li>We have to create a callAgent object which is used to start and manage calls</li>
<li>Currently the callAgent is needed to get the DeviceManager object which gives us access to Cameras, Microsphones, and Speakers for our calls.</li>
<li>We can force a browser consent with the call to askDevicePermission method</li>
</ul>
</p>
<p>
```
    //will assume all are new users for brevity
    //Get the ACS Auth Token
    let postObject = new Object();
    postObject.UserId = "";
    postObject.UserEmail = "foo@bar.com";

    const response = await fetch("/api/ACS/AuthGet", {
        method: "POST",
        body: JSON.stringify(postObject),
        headers: { "Content-Type": "application/json; charset=utf-8" }
    });
    const result = response.json();

    result.then(async (tokenResponse) => {

        var token = tokenResponse.Token;

        callClient = new CallClient();

        let tokenCredential = new AzureCommunicationUserCredential(token);

        callAgent = await callClient.createCallAgent(tokenCredential, { displayName: getCookie("name") });

        vidButton.disabled = false;

        deviceManager = await callClient.getDeviceManager();

        LoadDeviceDropdowns(deviceManager);

        //browser consent
        await deviceManager.askDevicePermission(true, true);
        ```
</p>
<h3>Joining the Call</h3>
<p>
The code block below highlights video options:
• Currently to join the call, we have to use the CallOptions with a local video stream and a microsophone muted status. I’m hoping this changes as it would be like joining a Teams call, forcing video to be on, then allowing a person to turn it off once joined.
• The “call” object is returned from the join method, which we then can add event listeners. Note the remoteParticipantsUpdated listener. This allows us to track participants who come and go from the call
</p>
<p>
```
const JoinVideo = async () => {
//setup the video device to be used
if (localVideoStream === undefined) {
await ToggleVideo();
}
const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] },
audioOptions: { muted: myMicrophoneMuted } };
const context = { groupId: groupId };

    call = callAgent.join(context, placeCallOptions);
    document.getElementById('status-box').style.display = 'block'
    document.getElementById('participant-panel').style.display = 'block';
    ShowCallState();

    hangUpButton.disabled = false;
    document.getElementById('hang-up-button').style.display = 'block';
    vidButton.disabled = true;

    //call on state changed
    call.on('callStateChanged', (e) => {
        ShowCallState();
        if (call.state === 'Connected') {
            processNewParticipants(call.remoteParticipants);
        }
    });

    //remote participants check
    call.on("remoteParticipantsUpdated", (e) => {
        processNewParticipants(e.added);
        if (e.removed.length > 0) {
            console.log("hung up " + e.removed[0].displayName);
            //look for the remote
            e.removed.forEach((remoteParticipant) => {
                let removodedId = "remote-" + GetId(remoteParticipant.identifier.communicationUserId);
                console.log('Removing Id:  ' + removodedId);
                // $("#remote-displays").find($("#" + removodedId)).remove();
                document.querySelector("#remote-displays #" + removodedId).remove();
            });
        }


        document.getElementById("call-participants").innerText = call.remoteParticipants.length
    });

    //show local stream
    await DisplayLocalVideo();

};
```
</p>
<h3>New Participant handler:</h3>
<p>
• When participants are added, we can hook up listeners for those participants. Note the videoStreamsUpdated listener so that we can understand if it is a screen sharing stream or a video stream (we can do both!)
</p>
<p>
//process new participants
const processNewParticipants = (remoteParticipants) => {
if (remoteParticipants.length === 0) return;
for (let addedParticipant of remoteParticipants) {
processNewVideoSteams(addedParticipant, addedParticipant.videoStreams);
addedParticipant.on('videoStreamsUpdated', (rpvEvent) => {
processNewVideoSteams(addedParticipant, rpvEvent.added);
});
addedParticipant.on("displayNameChanged", () => {
console.log('have streamid for participant: ' + addedParticipant.videoStreams[0].id);
ShowParticipantList();
});

    }
    ShowParticipantList();

};
</p>
<h3>Turning Video On and Off</h3>
<p>
The snippet below walks you through toggling your local video once in the call.
</p>
<p>
```
const ToggleVideo = async () => {
let videoSwitch = document.getElementById("local-video-switch")

    if (myCameraMuted) {

        videoSwitch.classList.remove("inactive-control");
        videoSwitch.classList.add("active-control");
        document.getElementById("my-cam-on").classList.remove("hidden");
        document.getElementById("my-cam-off").classList.add("hidden");

        if (localVideoStream === undefined) {
            await DisplayLocalVideo();
        }
        else {
            videoElement.appendChild(localView.target);
        }

        if (call !== undefined) {
            await call.startVideo(localVideoStream);
        }
        myCameraMuted = false;
    } else {

        videoSwitch.classList.remove("active-control");
        videoSwitch.classList.add("inactive-control");
        document.getElementById("my-cam-on").classList.add("hidden");
        document.getElementById("my-cam-off").classList.remove("hidden");

        if (call !== undefined) {
            await call.stopVideo(localVideoStream);
        }
        videoElement.removeChild(localView.target);
        myCameraMuted = true;
    }

};

const DisplayLocalVideo = async () => {
if (localView === undefined) {
if (localVideoStream === undefined) {
localVideoStream = new LocalVideoStream(GetActiveCamera());
}
const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] },
audioOptions: { muted: myMicrophoneMuted } };
let renderer = new Renderer(localVideoStream);
localView = await renderer.createView();
videoElement.appendChild(localView.target);
document.getElementById("local-video-switch").setAttribute("data-value", "on");
return localVideoStream;
}
};
```
</p>
<h2>Bundling</h2>
<p>
The hardest part of this for me was bundling. The JavaScript SDK is distributed as node modules. This is great for the dev that lives in VS Code and talks about things like Grunt, Webpack, Node, TypeScript etc.. (you know, all the cool kid stuff). My skills are not there yet. So I had to figure out how to get a bundled javascript file put together that combines my “video” script with the SDK. Here is how I achieved it.
Visual Studio Extensions
</p>
<p>
I installed a couple of extensions for Visual Studio 2019:

1. Open Command Line
2. NPM Task Runner
</p>
Now – I open a developer command prompt using the Open Command Line extension

We now need to run a few commands to get the SDK and setup up the project for bundling the final JS file, which I’ll call bundle.js.
<ul>
<li>npm install (creates the package.lock.json file)</li>
<li>npm init -y (creates the package.json)</li>
<li>npm install --global webpack@4.32.2 (I seemed to have to do a global install of the webpack tools)</li>
<li>npm install --global webpack-cli@3.3.2</li>
<li>npm install --global webpack-dev-server@3.5.1</li>
<li>npm install webpack@4.32.2 --save-dev (These commands will add dependencies in the config file)</li>
<li>npm install webpack-cli@3.3.2 --save-dev</li>
<li>npm install webpack-dev-server@3.5.1 --save-dev</li>
<li>npm install @azure/communication-common –save (Add the ACS JS SDKs and creates dependencies)</li>
<li>npm install @azure/communication-calling –save</li>
</ul>
<p>
At this point we should have the ACS SDK and the Webpack tooling installed into our project and a couple of files that we would typically had to our project; the package.lock.json and the package.json files. We will need to change the main entry from whatever is created to webpack.config.js
</p>
<p>
Package.json
{
"name": "remoteadvisor",
"version": "1.0.0",
"description": "",
"main": "webpack.config.js",
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1" },
    "keywords": [],
    "author": "",
    "license": "ISC",
    "dependencies": {
    "@azure/communication-calling": "^1.0.0-beta.3",
    "@azure/communication-common": "^1.0.0-beta.3"
},
    "devDependencies": {
    "webpack": "^4.32.2",
    "webpack-cli": "^3.3.2",
    "webpack-dev-server": "^3.5.1"
    }
}
</p>
<p>
Create a webpack.config.js file in your project root. This is where we configure our bundling.
</p>
<p>
I have modified my webpack.config.js to read:  
</p>
<p>
const path = require('path');
module.exports = {
entry: './Scripts/App/Index.js',
output: {
path: path.resolve(\_\_dirname, 'Scripts/App'),
filename: 'Bundle.js'
},
optimization: { minimize: false },
mode: 'none'
};
</p>
<p>
My code for the video is in the “entry” setting (Index.js). The output bundle will be in the Bundle.js file. You should now be ready to create your first bundle.  
Run the following command: npx webpack-cli --config ./webpack.config.js –debug
You can now go look at the resulting bundle in your output directory. You would need to then add this bundle to your project.  
</p>
<h3>Automating the Bundle</h3>
<p>
Dropping to a command prompt every time you make a change to your index.js file would be painful. Therefore, we will leverage the NPM Task Runner extension. I created a before build task as shown below.

Setting this up will create the bundle before each build.  
</p>
<h2>Summary</h2>
<p>
I know there is a lot of information in this article, and probably a few inaccuracies but the goal was to highlight the ability to add video calling to an application and get the SDK working in a ASP.Net Web Application. I have also put the code that I used in this example in a Github Repo.
</p>

