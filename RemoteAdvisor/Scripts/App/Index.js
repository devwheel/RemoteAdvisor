﻿import { CallClient, CallAgent, LocalVideoStream, Call, AudioDeviceInfo, VideoDeviceInfo, RemoteParticipant, VideoStreamRenderer } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { getCookie, setCookie } from './Cookies.js'

let callClient;
let deviceManager;
let callAgent;
let call;

let localVideoStream;
let localView;


let cameras;
let activeCamera;
let rendererLocal;
let rendererRemote;
let rendererScreenshare;
let microphones;
let speakers;
let showLogs = false;
let recipientTracker = [];
let talkTimer;

let lastCamera = 0;
let lastMicrophone = 0;
let lastSpeaker = 0;
const consoleOut = document.getElementById("console-out");
const btnHangup = document.getElementById("hang-up-button");
const btnJoinCall = document.getElementById("video-button");
const btnVideoToggle = document.getElementById("local-video-switch");
const btnMicrophoneToggle = document.getElementById("local-microphone-switch");
const btnShare = document.getElementById("btn-share");
const btnAddRemote = document.getElementById("btnAddRemote");
const btnAddTeams = document.getElementById("add-teams");

const loginModal = new bootstrap.Modal(document.getElementById("modal-login")); //capture name for primary user
const inviteModal = new bootstrap.Modal(document.getElementById("contact-modal"));  //capture name/cell to invite
const localVideoToggler = document.getElementById("local-video-toggler");
const localVideoElement = document.getElementById("video");
const refreshElement = document.getElementById("refresh-participants");
const loginButton = document.getElementById("btnLogin");
const remoteDisplays = document.getElementById("remote-displays");
const callinfoPanel = document.getElementById("call-info");
const participantPanel = document.getElementById("participant-panel");
const participantCount = document.getElementById("call-participants");
const callState = document.getElementById("call-state");
const showLogsButton = document.getElementById("show-logs");
const screenSharePanel = document.getElementById("screen-share");

const dropdownCamera = document.getElementById("camera-list");
const dropdownMicrophone = document.getElementById("mic-list");
const dropdownSpeaker = document.getElementById("speaker-list");

let groupId = '9fef326a-b48c-43e3-8ceb-a19025bc2777';

document.addEventListener('DOMContentLoaded', startup);

loginButton.addEventListener("click", async () => LoginOK(), false);  //Login

async function startup() {

    let name = GetUserName();
    LogConsole("name: " + name)

    if (name === null || name === '') {
        loginModal.show();
        return;
    } else {

        $("#call-panel").removeClass("hidden");
    }
    $("#userid").val(getCookie("acsuserid"));
    $("#login-name").val(name);
    $("#token").val(getCookie("token"));
    $("#token-expires").val(getCookie("expires"));
    let tokenResponse = await GetToken();
    LogConsole("tokenResponse", tokenResponse);
    await Init(tokenResponse.Token);

}

async function LoginOK() {
    loginModal.hide();
    setCookie("name", $("#user-name").val());
    await startup()
}

async function GetToken() {
    //will assume all are new users for brevity
    //Get the ACS Auth Token
    //Setup the Request object
    let tokenResponse;
    let token;
    let request = new Object();
    let acsUser = new Object();
    let result;
    acsUser.AcsUserId = GetUserId();
    acsUser.Name = GetUserName();
    acsUser.Email = GetUserEmail();
    request.User = acsUser;
    request.TokenExpires = getCookie("expires");
    request.Token = getCookie("token");
    const response = await fetch("/api/ACS/AuthGet", {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Content-Type": "application/json; charset=utf-8" }
    }).then((result) => result.json())
        .then((data) => tokenResponse = data)
    setCookie("acsuserid", tokenResponse.AcsUser.AcsUserId.Id);
    setCookie("email", tokenResponse.AcsUser.Email);
    setCookie("name", tokenResponse.AcsUser.Name);
    setCookie("token", tokenResponse.Token);
    setCookie("expires", tokenResponse.TokenExpires);
    return tokenResponse;
}

//********************************************************************* */
//  Initialize the Call Client and the Call Agent for the Users
//********************************************************************* */
async function Init(token) {
    
    LoadCookieSettings(); //Settings for last used devices

    //Create callClient and callAgent
    callClient = new CallClient();
    let tokenCredential = new AzureCommunicationTokenCredential(token);
    let displayName = getCookie("name");
    LogConsole("creating call agent for " + displayName);
    callAgent = await callClient.createCallAgent(tokenCredential, { displayName: displayName });
    LogConsole("created call agent", callAgent);

    //Get the device manager
    deviceManager = await callClient.getDeviceManager();
    LogConsole("deviceManager", deviceManager);

    //Browser consent
    if (isMobileBrowser() === false)
        await deviceManager.askDevicePermission({ video: true, audio: true });

    //Load Device Dropdowns with Devices
    await LoadDeviceDropdowns(deviceManager);
    await GetActiveCamera();
    btnJoinCall.classList.remove("hidden");
}

// ********************************************************************* */
//  Join the Meeting with Video
// ********************************************************************* */
async function JoinVideo() {
    // Turn on Video if it is not there
    await GetActiveCamera();
    if (localVideoStream === undefined) {
        localVideoStream = new LocalVideoStream(activeCamera);
        await ToggleVideo(); //need to fix
    }
    const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: true } };

    let customGroupId = $("#meetingId").val();
    let context;
    
    if (customGroupId.indexOf("teams") > -1) {
        context = { meetingLink: customGroupId };
    } else {
        context = { groupId: groupId };   //context of the call Group/Teams/Room/etc
    }

    //Setup the call/meeting
    call = callAgent.join(context, placeCallOptions);
    LogConsole("call", call);
    // Configure all the call events/callbacks
    await subscribeToCall(call);

    await ShowCallState(call);  //Connecting..=> connected
    await ShowParticipantList();
    //UX Settings for a connected call
  
    ActivateCallDependantElements();
};

// load devices into dropdowns for changing
async function LoadDeviceDropdowns(deviceMgr) {
    //mobile device so don't setup dropdowns
    //get all the camera devices
    cameras = await deviceMgr.getCameras();
    LogConsole("camera enumeration", cameras);
    //add the cameras to the dropdown list
    let i = 0;
    cameras.forEach(camera => {
        console.log(camera);
        let option = document.createElement('option');
        option.value = GetId(camera.id);
        option.setAttribute("data-id", camera.id);
        option.innerHTML = camera.name.replace(/ *\([^)]*\) */g, "");
        dropdownCamera.appendChild(option);
        i++;
    });

    dropdownCamera.selectedIndex = lastCamera;

    activeCamera = GetActiveCamera();
    LogConsole(`[LoadDeviceDropdowns] init last camera name = ${activeCamera.name}`);

    //get all the mics
    microphones = await deviceMgr.getMicrophones();
    //add the mics to the dropdown list
    i = 0;
    microphones.forEach(mic => {
        let option = document.createElement('option');
        option.value = mic.id;
        //option.innerHTML = mic.name.replace(/ *\([^)]*\) */g, "");;
        option.innerHTML = mic.name;
        if (i === lastMicrophone) {
            option.selected = true;
        }
        dropdownMicrophone.appendChild(option);
        i++;
    });

    LogConsole(`isMobileBrowser=${isMobileBrowser() === false}`);


    if (isMobileBrowser() === false) {

        //get all the speakers
        speakers = await deviceMgr.getSpeakers();
        //add the mics to the dropdown list
        i = 0;
        speakers.forEach((speaker) => {
            let option = document.createElement('option');
            option.value = speaker.id;
            //option.innerHTML = speaker.name.replace(/ *\([^)]*\) */g, "");
            option.innerHTML = speaker.name;
            if (i === lastSpeaker) {
                option.selected = true;
            }
            dropdownSpeaker.appendChild(option);
            i++;
        });
        document.getElementById("speakers").classList.remove("hidden");
    } else
    {

        document.getElementById("speakers").classList.add("hidden");

    }
    await SetupListeners();
    document.getElementById("device-list-loading").classList.add("hidden");
    document.getElementById("device-list").classList.remove("hidden");
    document.getElementById("toolbar").classList.remove("hidden");
}

function IsRemoteParticipantSpeakingCheck(state) {
    if (state == true) {
        if (call !== undefined) {
            talkTimer = setInterval(() => {
                for (let i = 0; i < call.remoteParticipants.length; i++) {
                    let speakerId = GetId(call.remoteParticipants[i].identifier.communicationUserId);
                    if (call.remoteParticipants[i].isSpeaking) {
                        //clear is speaking style on all remotes
                        let remotes = document.querySelectorAll(".remote-name-panel");
                        LogConsole(`[IsRemoteParticipantSpeakingCheck] remotes=${remotes.length}`);
                        //remotes.forEach((remote) => {
                        //    let name = remote.getAttribute("data-name");
                        //    LogConsole(`[IsRemoteParticipantSpeakingCheck] resetting ${name}`);
                        //    let remoteId = remote.getAttribute("id");
                        //    console.log(remote);
                        //    remote.innerHTML = name + "reset";
                        //    let namePanel = document.getElementById(remoteId);
                        //    //namePanel.style.display = "none";
                        //    namePanel.innerHTML = name;
                        //    LogConsole(document.getElementById(remoteId).innerHTML);
                        //})
                        //add is speaking style to this remote
                        let targetNameId = `remote-speaker-${speakerId}`;
                        let remoteNameEl = document.getElementById(targetNameId);
                        remoteNameEl.classList.remove("hidden");

                        LogConsole(`[IsRemoteParticipantSpeakingCheck] ${remoteName} is speaking`);
                    }
                    else {
                        //remote participant is not speaking so hide the is speaking style
                        let targetNameId = `remote-name-${speakerId}`;
                        let remoteNameEl = document.getElementById(targetNameId);
                        let remoteName = remoteNameEl.getAttribute("data-name");
                        remoteNameEl.classList.add("hidden");
                    }
                }
            }, 5000)
        }
    }
    else {
        clearInterval(talkTimer);
    }
}


async function DisplayLocalVideo() {

    if (localView === undefined) {
        if (localVideoStream === undefined) {
            activeCamera = await GetActiveCamera();
            LogConsole(`[displaylocalvidoe] We have an active camera ${activeCamera.name}`, activeCamera);
            localVideoStream = new LocalVideoStream(activeCamera);
        }
        rendererLocal = new VideoStreamRenderer(localVideoStream);
        localView = await rendererLocal.createView();
        localVideoElement.innerHTML = "";
        if (getChildNodeCount('video') === 0) {
           
            localVideoElement.appendChild(localView.target);
        }

        return localVideoStream;
    }
    else {
        LogConsole("[DisplayLocalVideo]  local video already displayed");
    }
};

async function CreateRemoteParticipantElement(id, userName) {
    LogConsole("creating remote box for " + userName);
    let elementId = `remote-${id}`;
    let remoteElement = document.getElementById(elementId);
    if (remoteElement !== null) {
        LogConsole("element exists");
        alert("element exists");
        return;
    }

    let remoteEl = document.createElement("div");
    remoteEl.id = "remote-" + id;
   // remoteEl.classList.add("formal-section");
    remoteEl.classList.add("video-card");
    remoteEl.classList.add("remote-panel");
    //Create the video-card-header div
    //<div class="video-card-header">
    let elHdr = document.createElement("div");
    elHdr.classList.add("video-card-header")
    elHdr.innerHTML = "Remote Participant Video";
    remoteEl.appendChild(elHdr);
    //create the video-card-content div
    //<div class="video-card-content">
    let elVcc = document.createElement("div");
    elVcc.classList.add("video-card-content");
    elVcc.id = `remote-video-${id}`;
    remoteEl.appendChild(elVcc);

    //create the video-panel div
    //<div class="video-panel">
    let elVP = document.createElement("div");
    elVP.id = "video-" + id;
    elVP.className = "video-panel";
    elVcc.appendChild(elVP);

    //Create toolbar
    let tbEl = document.createElement("div");
    tbEl.className = "video-panel-toolbar justify-content-center d-flex";

    let nmIco = document.createElement("i");
    nmIco.id = "remote-speaker-" + id;
    nmIco.className = "fas fa-volume-up hidden me-2";

    tbEl.appendChild(nmIco);
    

    let nmEl = document.createElement("div");
    nmEl.id = "remote-name-" + id;
    nmEl.setAttribute("data-name", userName);
    nmEl.classList.add("remote-name-panel");
    nmEl.classList.add("text-center");
    nmEl.innerHTML = userName;
    tbEl.appendChild(nmEl);

    elVcc.appendChild(tbEl);
    remoteEl.appendChild(elVcc);

    //remoteEl.innerHTML = newElement;
    remoteDisplays.appendChild(remoteEl);
    return id;
};

async function DisplayRemoteVideo(id, remoteStream) {
    let elId = `video-${id}`;
    console.log("displaying remote video" + elId);
 
        LogConsole(`Trying to display Remote Video at ${elId}`);
        if (rendererRemote === undefined)
            rendererRemote = new VideoStreamRenderer(remoteStream);

        let view = await rendererRemote.createView();
        if (view !== null) {
            let el = document.getElementById(elId);
            if (el === null) {
                LogConsole(`Can't find element ${elId}, retrying in 3 seconds`);
                setTimeout(async () => {
                    await DisplayRemoteVideo(id, remoteStream);
                }, 3000);
            } else {
                let childCount = getChildNodeCount(elId);
                LogConsole(`childCount: ${childCount}`);
                if (childCount == 0) {
                    el.appendChild(view.target);
                }
            }
        }
    
}

async function DisplayRemoteScreenshare(remoteStream) {
    let elId = `screen-share-content`;
    LogConsole(`Trying to display Screen Share at ${elId}`);
    screenSharePanel.classList.remove("hidden");
    if (rendererScreenshare === undefined)
        rendererScreenshare = new VideoStreamRenderer(remoteStream);

    let viewScreenShare = await rendererScreenshare.createView();
    let el = document.getElementById(elId);
    el.appendChild(viewScreenShare.target);
}

function DestroyRemoteParticpantElement(id) {
    let remoteElementEl = "remote-" + id;
    let remoteElement = document.getElementById(remoteElementEl);
    LogConsole("destroying remoteElement", remoteElement);
    if (remoteElement !== null) {
        remoteElement.parentNode.removeChild(remoteElement);
    }
}

function DestroyRemoteParticipantVideo(id) {
    let videoId = `video-${id}`;
    let videoNode = document.getElementById(videoId);
    if (videoNode !== null) {
        //Check on all participants as the person muting video would fail here
        while (videoNode.lastElementChild) {
            videoNode.removeChild(videoNode.lastElementChild);
        }
    }
}

function DestroyScreenSharing(id) {
    let videoNode = document.getElementById(id);
    if (videoNode !== null) {
        //Check on all participants as the person muting video would fail here
        while (videoNode.lastElementChild) {
            videoNode.removeChild(videoNode.lastElementChild);
        }
    }
    screenSharePanel.classList.add("hidden");
}

async function DestroyLocalVideo() {
    //Check on all participants as the person muting video would fail here
    while (video.lastElementChild) {
        video.removeChild(video.lastElementChild);
    }
    localVideoElement.innerHTML = "Local Preview";
    if (localView !== undefined) {
        localView.dispose();
        localView = undefined;
    }
}

// get the camera selected in the dropdown
async function GetActiveCamera() {
    let cameraList = document.getElementById("camera-list");
    let cameraId = cameraList.options[cameraList.selectedIndex].getAttribute("data-id");
    let camDeviceInfo = cameras.filter(cam => cam.id == cameraId)[0];
    activeCamera = camDeviceInfo;
    return activeCamera;
};

// load settings from cookies
function LoadCookieSettings() {
    //see if a different camera was set
    let cameraCheck = getCookie("camera");
    if (cameraCheck !== null) {
        lastCamera = cameraCheck;
    }
    //see if a different mic was set
    let microphoneCheck = getCookie("microphone");
    if (microphoneCheck !== null) {
        lastMicrophone = microphoneCheck;
    }
    //see if a different speaker was set
    let speakerCheck = getCookie("speaker");
    if (speakerCheck !== null) {
        lastSpeaker = speakerCheck;
    }

};

// Setup actions on all the buttons on the screen
// Join Call, Refresh Participants, Change Camera, Change Microphone, Change Speaker
async function SetupListeners() {

    //join video
    btnJoinCall.addEventListener("click", async () => JoinVideo(), false);

    //refresh participants
    refreshElement.addEventListener("click", async () => {
        if (call !== undefined) {
            await ShowParticipantList();
        } else {
            alert('there is no call');
        }
    });

    //change camera
    dropdownCamera.addEventListener("change", async () => {
        let cameraList = document.getElementById("camera-list");
        let cameraId = cameraList.options[cameraList.selectedIndex].getAttribute("data-id");
        let camDeviceInfo = cameras.filter(cam => cam.id == cameraId)[0];
        console.log(camDeviceInfo);
        activeCamera = camDeviceInfo;
        LogConsole(`switching to camera ${activeCamera.name}`);
        if (localVideoStream !== undefined) {
            try {
                localVideoStream.switchSource(camDeviceInfo);
            }
            catch (err) {
                alert(`Error switching camera.  Camera ${camDeviceInfo.name} may be in use.`);
                return;
            }
            setCookie("camera", cameraList.selectedIndex);
        }
        

    });

    //change microphone
    dropdownMicrophone.addEventListener("change", async () => {
        let micIndex = document.getElementById("mic-list").selectedIndex;
        let micDeviceInfo = microphones[micIndex];
        setCookie("microphone", micIndex);
        await deviceManager.selectMicrophone(micDeviceInfo);

    });

    //change speaker
    dropdownSpeaker.addEventListener("change", async () => {
        let speakerIndex = document.getElementById("speaker-list").selectedIndex;
        let speakerDeviceInfo = speakers[speakerIndex];
        setCookie("speaker", speakerIndex);
        await deviceManager.selectMicrophone(speakerDeviceInfo);
    });

    //hangup the call
    btnHangup.addEventListener("click", async () => {

        // end the current call
        call.hangUp();

        //Remove all remote displays after hangup
        const remoteDiplays = document.querySelectorAll('.remote-panel');
        remoteDiplays.forEach(display => {
            display.remove();
        });

        // toggle button states
        btnHangup.classList.add("hidden");
        btnJoinCall.classList.remove("hidden");
        await ShowCallState(call);
        participantPanel.classList.add("hidden");
        callinfoPanel.classList.add("hidden");
        ToggleVideo();
        ToggleAudio();
        call.dispose();
        call = undefined;
        btnVideoToggle.classList.remove("active-control");
        btnVideoToggle.classList.add("inactive-control");

    });

    //toggle local video
    btnVideoToggle.addEventListener("click", async () => {
        LogConsole("toggle video");
        await ToggleVideo();
    });

    //toggle mute
    btnMicrophoneToggle.addEventListener("click", async () => {
        await ToggleAudio();

    });

    //show logs area
    showLogsButton.addEventListener("click", () => {
        if (showLogs == true) {
            consoleOut.classList.add("hidden");
            showLogs = false;

        }
        else {
            consoleOut.classList.remove("hidden");
            showLogs = true;
        }

    })

    localVideoToggler.addEventListener("click",async () => {
        var newState = await ToggleResizePreview();
        
    })

    
    btnAddRemote.addEventListener("click", () => {
        AddClientToSession();
    });

    btnShare.addEventListener("click", async () => {
        await ToggleShare();
        if (call !== undefined) {
            await call.startScreenSharing();
        }
        if (call !== undefined) {
            await call.stopScreenSharing();
        }
    });

};

function ToggleMediaElement(el) {
    let elState = el.getAttribute("data-state");
    let faAttrOff; let faAttrOn; let titleOff; let titleOn;
    let classOff; let classOffTarget;
    faAttrOff = el.getAttribute("data-off");
    faAttrOn = el.getAttribute("data-on");
    titleOn = el.getAttribute("data-offTitle");
    titleOff = el.getAttribute("data-onTitle");
    classOff = el.getAttribute("data-offClass");
    classOffTarget = el.getAttribute("data-offClassTarget");

    if (elState === "on") {
        el.setAttribute("data-state", "off");
        el.classList.remove("on-state"); el.classList.add("off-state");
        el.classList.remove(faAttrOn); el.classList.add(faAttrOff);
        el.setAttribute("title", titleOff);
        if (classOff !== null && classOffTarget != null) {
            let targetEl = document.getElementById(classOffTarget);
            targetEl.classList.remove(classOff);
        }
        return "off";
    }
    else {
        el.setAttribute("data-state", "on");
        el.classList.remove("off-state"); el.classList.add("on-state");
        el.classList.remove(faAttrOff); el.classList.add(faAttrOn);
        el.setAttribute("title", titleOn);
        if (classOff !== null && classOffTarget != null) {
            let targetEl = document.getElementById(classOffTarget);
            targetEl.classList.add(classOff);
        }
       
        return "on";
    }
    
}

// toggle video sets the action on the button
// and the UX state
async function ToggleVideo() {
    var newState = await ToggleMediaElement(btnVideoToggle);
    if (newState === 'on') {
        LogConsole(`turning video on for ${activeCamera.name}`);
        if (localVideoStream === undefined) {
            localVideoStream = await DisplayLocalVideo();
        }
        else {
            if (localView === undefined) {
                try {
                    localView = await rendererLocal.createView();
                }
                catch (err) {
                    LogConsole("Error creating local view: " + err);
                    
                    var newState = await ToggleMediaElement(btnVideoToggle);
                    return;
                }
            }
            localVideoElement.appendChild(localView.target);
        }

        if (call !== undefined && call !== null) {
            try {
                await call.startVideo(localVideoStream);
            } catch (err) {
                LogConsole("Error starting video: " + err);
            }
        }
    } else {
        try {
            if (call !== undefined && call !== null) {
                LogConsole("isLocalVideoStarted", call.isLocalVideoStarted)
                LogConsole("stopping video on call", call);
                await call.stopVideo(localVideoStream);

            }
        } catch (e) {
            LogConsole("toggle off error" + e);
        }
        await DestroyLocalVideo();

    }
   
};

// toggle audio sets the action on the button
async function ToggleAudio() {
    var newState = await ToggleMediaElement(btnMicrophoneToggle);
    if (call !== undefined) {
        if (newState === "on") {
            LogConsole("unmute call");
            call.unmute();
        } else {
            LogConsole("mute call");
            call.mute();
        }
    }
}

async function ToggleShare() {
    ToggleMediaElement(btnMicrophoneToggle);
    return;
}

async function ToggleResizePreview() {
    var newState = ToggleMediaElement(localVideoToggler);

}

// update the UX for the call state
async function ShowCallState(e) {
    //  let icon = "<i class='fas fa-phone-alt'></i>";
    //might do something here later
    if (e.state !== undefined) {
        switch (e.state) {
            case 'None':
                break;
            case 'Incoming':
                break;
            case 'Connecting':
                btnJoinCall.classList.add("hidden");
                btnHangup.classList.remove("hidden")
                break;
            case 'Ringing':
                break;
            case 'Connected':
                btnJoinCall.classList.add("hidden");
                btnHangup.classList.remove("hidden");
                break;
            case 'Hold':
                break;
            case 'InLobby':
                break;
            case 'Disconnecting':
                btnJoinCall.classList.remove("hidden");
                btnHangup.classList.add("hidden");
                break;
            case 'Disconnected':
                btnJoinCall.classList.remove("hidden");
                btnHangup.classList.add("hidden");
                break;
            case 'EarlyMedia':
                break;
            default:
                break;
        }
        document.getElementById("call-state").innerText = call.state;
    }
};

// Show the participants connected to the call
async function ShowParticipantList() {

    let partElement = document.getElementById('participants');
    //remove all the participants
    // partElement.find('option').remove();
    partElement.innerHTML = null;

    //add the local users
    let me = getCookie("name");
    // var option = $("<option />");
    // option.html(me);
    let option = document.createElement('option');
    option.innerHTML = me;

    partElement.appendChild(option);

    //add remote users
    if (call !== undefined) {
        var participants = call.remoteParticipants;

        participants.forEach(part => {
            part.videoStreams.forEach((stream) => {
                if (stream.type === 'Video') {
                    UpdateRemoteParticipantName(GetId(part.identifier.communicationUserId), part.displayName);
                    LogConsole("video part identifier:", part.identifier);
                }
            });

            let option = document.createElement('option');
            option.innerHTML = part.displayName;

            partElement.appendChild(option);

        });
        participantCount.innerHTML = `${participants.length} Remote Users`;
        if (participants.length === 0) {
            //turn off speaker checking
            IsRemoteParticipantSpeakingCheck(false);
        }
    } else {
        participantCount.innerHTML = `0 Remote Users`;
    }

  
};

// Update the UX with the remote participant name
function UpdateRemoteParticipantName(userId, name) {
    document.getElementById("remote-name-" + userId).innerHTML = name;
};

function GetUserId() {
    let user = getCookie("acsuserid");
    return user;
}

function GetUserName() {
    let user = getCookie("name");
    return user;
}

function GetUserEmail() {
    let email = getCookie("email");
    if (email == null) {
        email = "user@foo.bar";
    }
    return email;
}

function GetId(data) {
    if (data !== undefined) {
        console.log("data", data);
        let array = data.split(':');
        let len = array.length;
        return array[len - 1];
    }
    else { return 'no-id'; }
};

function ActivateCallDependantElements() {
    let callElements = document.getElementsByClassName("call-dependant");
    for (var i = 0; i < callElements.length; i++) {
        callElements[i].classList.remove("hidden");
    }
  
}

function AddClientToSession() {
    var contact = new Object();
    contact.ToName = $("#client-name").val();
    contact.ToCellNumber = $("#client-cell").val();
    contact.MeetingId = $("#meetingId").val();


    $.ajax({
        url: '/api/sms/invite',
        cache: false,
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(contact),
        success: function (data) {
            console.log(data);
            inviteModal.hide();
        },
        error: function (a, b, c) {
            console.log(a, b, c);
            alert(a);
            var c = a;
        }
    });
}


// Subscribe to a call obj.
// Listen for property changes and collection updates.
async function subscribeToCall(call) {
    try {
        //Subscribe to call's 'idChanged' event for value changes.
        call.on('idChanged', () => {
            LogConsole(`Call Id changed: ${call.id}`);
        });

        // Subscribe to call's 'stateChanged' event for value changes.
        call.on('stateChanged', async () => {
            await ShowCallState(call);
        });
        // Show the local Video Stream
        call.localVideoStreams.forEach(async (lvs) => {
            LogConsole("show the local video")
            localVideoStream = lvs;
            await DisplayLocalVideo()
        });

        // Handle the local video stream updated
        call.on('localVideoStreamsUpdated', e => {
            LogConsole("local video stream updated", e);
            e.added.forEach(async (lvs) => {
                localVideoStream = lvs;
                await DisplayLocalVideo();
            });
            e.removed.forEach(lvs => {
                removeLocalVideoStream();
            });
            setTimeout(async () => {
                await ShowParticipantList();
            }, 3000)
        });

        // Inspect the call's current remote participants and subscribe to them.
        LogConsole("subscribing to remote participants already in call");
        call.remoteParticipants.forEach(async (remoteParticipant) => {
            await subscribeToRemoteParticipant(remoteParticipant);
        })
        // Subscribe to the call's 'remoteParticipantsUpdated' event to be
        // notified when new participants are added to the call or removed from the call.
        LogConsole("listening for remote participants");
        call.on('remoteParticipantsUpdated', e => {
            // Subscribe to new remote participants that are added to the call.
            e.added.forEach(async (remoteParticipant) => {
                await subscribeToRemoteParticipant(remoteParticipant)
            });
            // Unsubscribe from participants that are removed from the call
            e.removed.forEach(remoteParticipant => {
                LogConsole('Remote participant removed from the call.');
            })
        });

    } catch (error) {
        console.error(error);
    }
}

// Subscribe to a remote participant obj.
// Listen for property changes and collection updates.
async function subscribeToRemoteParticipant(remoteParticipant) {
    try {
        // Inspect the initial remoteParticipant.state value.
        LogConsole(`Remote participant state: ${remoteParticipant.state}`);
        // Subscribe to remoteParticipant's 'stateChanged' event for value changes.
        remoteParticipant.on('stateChanged', async () => {
            let id = GetId(remoteParticipant.identifier.communicationUserId);
            LogConsole(`Remote participant state changed: ${remoteParticipant.state}`);
            if (remoteParticipant.state === 'Connected') {
                setTimeout(async () => {
                    await CreateRemoteParticipantElement(id, remoteParticipant.displayName);
                    ShowParticipantList();
                }, 3000)
                IsRemoteParticipantSpeakingCheck(true);
            }
            if (remoteParticipant.state === 'Disconnected') {
                //Remote Participant hung up so remove the element
                DestroyRemoteParticpantElement(id);
                ShowParticipantList();
            }
        });

        // Inspect the remoteParticipants current videoStreams and subscribe to them.
        remoteParticipant.videoStreams.forEach(async (remoteVideoStream) => {
            await subscribeToRemoteVideoStream(remoteParticipant)
        });
        // Subscribe to the remoteParticipant's 'videoStreamsUpdated' event to be
        // notified when the remoteParticipant adds new videoStreams and removes video streams.
        remoteParticipant.on('videoStreamsUpdated', e => {
            // Subscribe to new remote participant's video streams that were added.
            e.added.forEach(async (remoteVideoStream) => {
                LogConsole("subscribing to remote video stream");
                await subscribeToRemoteVideoStream(remoteParticipant);

            });
            // Unsubscribe from remote participant's video streams that were removed.
            e.removed.forEach(remoteVideoStream => {
                LogConsole('Remote participant video stream was removed.');
                let id = GetId(remoteParticipant.identifier.communicationUserId);
                DestroyRemoteParticpantElement(id);
            })
        });
    } catch (error) {
        console.error(error);
    }
}

// Subscribe to a remote participant's remote video stream obj.
// Listen for property changes and collection updates.
// When their remote video streams become available, display them in the UI.
async function subscribeToRemoteVideoStream(remoteParticipant) {
    let remoteVideoStream = remoteParticipant.videoStreams.find(function (s) { return s.mediaStreamType === "Video" });
    let screenShareStream = remoteParticipant.videoStreams.find(function (s) { return s.mediaStreamType === "ScreenSharing" });
    let id = GetId(remoteParticipant.identifier.communicationUserId);

    remoteVideoStream.on('isAvailableChanged', async () => {
        LogConsole(`visibility changed for ${id}`, remoteVideoStream.isAvailable);
        // Participant has switched video on.
        if (remoteVideoStream.isAvailable) {
            LogConsole("remote participant is now available for " + remoteParticipant.displayName, remoteParticipant);
            console.log(remoteVideoStream.mediaStreamType);
            //remote stream is video - put in video element
            if (remoteVideoStream.mediaStreamType === "Video") {
                setTimeout(async () => {
                    await DisplayRemoteVideo(id, remoteVideoStream);
                }, 6000);
            }

            // Participant has switched video off.
        } else {
            DestroyRemoteParticipantVideo(id);
        }
    });
    screenShareStream.on('isAvailableChanged', async () => {
        LogConsole(`visibility changed for ${id}`, screenShareStream.isAvailable);
        // Participant has switched video on.
        if (screenShareStream.isAvailable) {
            LogConsole("remote participant is now available for " + remoteParticipant.displayName, remoteParticipant);
            console.log(screenShareStream.mediaStreamType);
            //remote stream is screen share - put in screen share element
            if (screenShareStream.mediaStreamType === "ScreenSharing") {
                await DisplayRemoteScreenshare(screenShareStream);
            }

            // Participant has stopped sharing video
        } else {
            DestroyScreenSharing("screen-share-content");
        }
    });

    // Participant has video on initially.
    if (remoteVideoStream.isAvailable) {
        let id = GetId(remoteParticipant.identifier.communicationUserId);
        setTimeout(async () => {
            await DisplayRemoteVideo(id, remoteVideoStream);
        }, 6000);
    }
}

function getChildNodeCount(element) {
    let el = document.getElementById(element);
    return el.childNodes.length;
}


//Log debug info
function LogConsole(data, object) {
    let el = document.createElement("div");
    el.innerHTML = data;
    consoleOut.appendChild(el);
    if (object !== undefined)
        console.log(data, object);
    else
        console.log(data);
}

function findRemoteParticipantById(id) {
    let rp = recipientTracker.find(c => c.id === id)[0];
    return rp;
}

function isMobileBrowser() {
    LogConsole("Checking for Mobile Browser");
    let a = false;
    if (navigator.userAgent.match(/Android/i)
        || navigator.userAgent.match(/webOS/i)
        || navigator.userAgent.match(/iPhone/i)
        || navigator.userAgent.match(/iPad/i)
        || navigator.userAgent.match(/iPod/i)
        || navigator.userAgent.match(/BlackBerry/i)
        || navigator.userAgent.match(/Windows Phone/i)) {
        a = true;
    } else {
        a = false;
    }
    LogConsole("Mobile Browser is " + a);
    return a;
}

export { getCookie, setCookie };

