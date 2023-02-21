﻿import { CallClient, CallAgent, LocalVideoStream, Call, AudioDeviceInfo, VideoDeviceInfo, RemoteParticipant, VideoStreamRenderer } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { getCookie, setCookie } from './Cookies.js'

let callClient;
let deviceManager;
let callAgent;
let call;

let localVideoStream;
let localView;


let myCameraMuted = true;
let myMicrophoneMuted = true;
let cameras;
let activeCamera;
let rendererLocal;
let rendererRemote;
let microphones;
let speakers;
let showLogs = false;
let recipientTracker = [];

let lastCamera = 0;
let lastMicrophone = 0;
let lastSpeaker = 0;
const consoleOut = document.getElementById("console-out");
const btnHangup = document.getElementById("hang-up-button");
const btnJoinCall = document.getElementById("video-button");
const btnVideoToggle = document.getElementById("local-video-switch");
LogConsole(btnVideoToggle);
const btnMicrophoneToggle = document.getElementById("local-microphone-switch");


const localVideoElement = document.getElementById("video");
const refreshElement = document.getElementById("refresh-participants");
const loginButton = document.getElementById("btnLogin");
const remoteDisplays = document.getElementById("remote-displays");
const callinfoPanel = document.getElementById("call-info");
const participantPanel = document.getElementById("participant-panel");
const participantCount = document.getElementById("call-participants");
const callState = document.getElementById("call-state");
const showLogsButton = document.getElementById("show-logs");

const dropdownCamera = document.getElementById("camera-list");
const dropdownMicrophone = document.getElementById("mic-list");
const dropdownSpeaker = document.getElementById("speaker-list");

const groupId = '9fef326a-b48c-43e3-8ceb-a19025bc2777';

document.addEventListener('DOMContentLoaded', startup);

loginButton.addEventListener("click", async () => LoginOK(), false);  //Login

async function startup() {

    $('#modal-login').on('shown.bs.modal', function () {
        $('#user-name').trigger('focus')
    })

    let name = GetUserName();
    LogConsole("name: " + name)
    let id = GetUserId();
    let email = GetUserEmail();

    if (name === null || name === '') {
        $('#modal-login').modal('show');
        return;
    } else {

        $("#call-panel").removeClass("hidden");
    }
    $("#userid").val(getCookie("acsuserid"));
    $("#email").val(getCookie("email"));
    $("#login-name").val(name);
    $("#token").val(getCookie("token"));
    $("#token-expires").val(getCookie("expires"));
    let tokenResponse = await GetToken();
    LogConsole("tokenResponse", tokenResponse);
    await Init(tokenResponse.Token);

}

async function LoginOK() {
    $('#modal-login').modal('hide');
    setCookie("name", $("#user-name").val());
    let tokenResponse = await GetToken();
    await Init(tokenResponse.Token);

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


    // Turn on Video if it is not there
    if (isMobileBrowser() === false)
        activeCamera = await GetActiveCamera();
    LogConsole("We have an active camera", activeCamera);

    btnJoinCall.classList.remove("hidden");

}

//********************************************************************* */
//  Join the Meeting with Video
//********************************************************************* */
async function JoinVideo() {
    // Turn on Video if it is not there
    if (localVideoStream === undefined) {
        localVideoStream = new LocalVideoStream(activeCamera);
        myCameraMuted = true;
        await ToggleVideo(); //need to fix
    }
    const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: myMicrophoneMuted } };
    const context = { groupId: groupId };   //context of the call Group/Teams/Room/etc

    //Setup the call/meeting
    call = callAgent.join(context, placeCallOptions);
    LogConsole("call", call);
    // Configure all the call events/callbacks
    await subscribeToCall(call);

    await ShowCallState(call);  //Connecting..=> connected
    ShowParticipantList();
    //UX Settings for a connected call
    participantPanel.classList.remove("hidden");
    callinfoPanel.classList.remove("hidden");
};

async function LoadDeviceDropdowns(deviceMgr) {
    //mobile device so don't setup dropdowns
    //get all the camera devices
    cameras = await deviceMgr.getCameras();
    LogConsole("camera enumeration", cameras);
    //add the cameras to the dropdown list
    let i = 0;
    cameras.forEach(camera => {
        let option = document.createElement('option');
        option.value = camera.id;
        option.innerHTML = camera.name.replace(/ *\([^)]*\) */g, "");
        if (camera.id === lastCamera) {
            option.selected = true;
        }
        dropdownCamera.appendChild(option);
        i++;
    });

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


    if (isMobileBrowser == false) {

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
    } else {
        activeCamera = cameras[0];
        LogConsole("camera: " + activeCamera.name);
        document.getElementById("speakers").classList.add("hidden");

    }
    SetupListeners();
    document.getElementById("device-list-loading").classList.add("hidden");
    document.getElementById("device-list").classList.remove("hidden");
}

async function DisplayLocalVideo() {
    if (localView === undefined) {
        if (localVideoStream === undefined) {
            activeCamera = await GetActiveCamera();
            localVideoStream = new LocalVideoStream(activeCamera);
        }
        const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: myMicrophoneMuted } };
        rendererLocal = new VideoStreamRenderer(localVideoStream);
        localView = await rendererLocal.createView();
        localVideoElement.appendChild(localView.target);
        return localVideoStream;
    }
};

async function DisplayRemoteVideo(id, remoteStream) {
    let elId = `video-${id}`;
    LogConsole(`Trying to display Remote Video at ${elId}`);
    if (rendererRemote === undefined)
        rendererRemote = new VideoStreamRenderer(remoteStream);

    let view = await rendererRemote.createView();
    if (view !== null) {
        let el = document.getElementById(elId);
        if (el === null) {
            LogConsole(`Can't find element ${elId}, retrying in 5 seconds`);
            setTimeout(async () => {
                await DisplayRemoteVideo(id, remoteStream);
            }, 3000);
        } else {
            el.appendChild(view.target);
        }


    }
}

async function CreateRemoteParticipantElement(id, userName) {
    LogConsole("creating remote box for " + userName);
    let elementId = `remote-${id}`;
    let remoteElement = document.getElementById(elementId);
    if (remoteElement !== null) {
        LogConsole("element exists");
        return;
    }

    //playing with the idea of tracking the objects and their elements
    let recip = new Object();
    recip.index = recipientTracker.length;
    recip.displayName = userName;
    recip.id = id;
    recip.element = elementId;
    recip.localVideoElement = `video-${id}`;
    recipientTracker.push(recip);

    let remoteEl = document.createElement("div");
    remoteEl.id = "remote-" + id;
    remoteEl.classList.add("col-5");
    remoteEl.classList.add("formal-section");
    remoteEl.classList.add("video-card-holder");
    remoteEl.classList.add("remote-panel");
    let elH5 = document.createElement("h5");
    elH5.innerHTML = "Remote Participant Video";
    remoteEl.appendChild(elH5);

    let elVC = document.createElement("div");
    elVC.classList.add("video-card");
    let elVP = document.createElement("div");
    elVP.id = "video-" + id;
    elVP.className = "video-panel";
    elVC.appendChild(elVP);

    //Create toolbar
    let tbEl = document.createElement("div");
    tbEl.className = "toolbar";

    let nmEl = document.createElement("div");
    nmEl.id = "remote-name-" + id;
    nmEl.classList.add("text-center");
    nmEl.innerHTML = userName;
    tbEl.appendChild(nmEl);

    elVC.appendChild(tbEl);
    remoteEl.appendChild(elVC);

    //remoteEl.innerHTML = newElement;
    remoteDisplays.appendChild(remoteEl);
    return id;
};

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

async function DestroyLocalVideo() {
    //Check on all participants as the person muting video would fail here
    while (video.lastElementChild) {
        video.removeChild(video.lastElementChild);
    }
    localView.dispose();
    localView = undefined;
}

async function GetActiveCamera() {
    if (!isMobileBrowser) {
        let list = document.getElementById("camera-list");
        let cameraId = list.value;

        let cameras = await deviceManager.getCameras();
        let camera = cameras.filter(cam => cam.id == cameraId)[0];
        return camera;
    } else {
        return cameras[0];
    }
};

function LoadCookieSettings() {
    //see if a different camera was set
    let cameraCheck = getCookie("camera");
    if (cameraCheck !== null) {
        lastCamera = cameraCheck;
    }
    //see if a different mic was set
    let microphoneCheck = getCookie("microphone");
    if (microphoneCheck !== null) {
        lastMicrophone = parseInt(microphoneCheck);
    }
    //see if a different speaker was set
    let speakerCheck = getCookie("speaker");
    if (speakerCheck !== null) {
        lastSpeaker = parseInt(speakerCheck);
    }

};

function SetupListeners() {

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
        let cameraId = document.getElementById("camera-list").value;
        setCookie("camera", cameraId);
        let camDeviceInfo = cameras.filter(cam => cam.id == cameraId)[0];
        if (localVideoStream !== undefined) {
            localVideoStream.switchSource(camDeviceInfo);
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
        myCameraMuted = true;
        ToggleVideo();
        call.dispose();
        call = undefined;
        document.getElementById("my-cam-on").classList.add("hidden");
        document.getElementById("my-cam-off").classList.remove("hidden");
        videoSwitch.classList.remove("active-control");
        videoSwitch.classList.add("inactive-control");

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

};

// toggle video sets the action on the button
// and the UX state
async function ToggleVideo() {
    let currentValue = btnVideoToggle.getAttribute("data-value");
    btnVideoToggle.setAttribute("disabled", "disabled"); //deactivate for the moment
    if (currentValue === 'off') {
        //UX Element State - Change to on:  Blue and Video and on data-value
        btnVideoToggle.setAttribute("data-value", "on");
        btnVideoToggle.setAttribute("title", "Turn off video");
        btnVideoToggle.classList.remove("red"); btnVideoToggle.classList.add("blue");
        btnVideoToggle.classList.remove("fas"); btnVideoToggle.classList.add("fas"); //get in the right order for fontawesome??
        btnVideoToggle.classList.remove("fa-video-slash"); btnVideoToggle.classList.add("fa-video");

        if (localVideoStream === undefined) {
            localVideoStream = await DisplayLocalVideo();
        }
        else {
            if (localView === undefined)
                localView = await rendererLocal.createView();
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
        //turn off video
        //UX Element State - Change to off:  Red and Video-Slas and off data-value
        btnVideoToggle.setAttribute("data-value", "off");
        btnVideoToggle.setAttribute("title", "Turn on video");
        btnVideoToggle.classList.remove("blue"); btnVideoToggle.classList.add("red");
        btnVideoToggle.classList.remove("fas"); btnVideoToggle.classList.add("fas"); //get in the right order for fontawesome??
        btnVideoToggle.classList.remove("fa-video"); btnVideoToggle.classList.add("fa-video-slash");


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
    btnVideoToggle.removeAttribute("disabled"); //re-activate
};

async function ToggleAudio() {
    let status = btnMicrophoneToggle.getAttribute("data-value");
    if (status === "off") {
        btnMicrophoneToggle.setAttribute("data-value", "on");
        btnMicrophoneToggle.setAttribute("title", "Turn off microphone");
        btnMicrophoneToggle.classList.remove("red"); btnMicrophoneToggle.classList.add("blue");
        btnMicrophoneToggle.classList.remove("fas"); btnMicrophoneToggle.classList.add("fas"); //get in the right order for fontawesome??
        btnMicrophoneToggle.classList.remove("fa-microphone-slash"); btnMicrophoneToggle.classList.add("fa-microphone");

        if (call !== undefined) {
            LogConsole("unmute call");
            call.unmute();
        }
    } else {

        btnMicrophoneToggle.setAttribute("data-value", "off");
        btnMicrophoneToggle.setAttribute("title", "Turn on microphone");
        btnMicrophoneToggle.classList.remove("blue"); btnMicrophoneToggle.classList.add("red");
        btnMicrophoneToggle.classList.remove("fas"); btnMicrophoneToggle.classList.add("fas"); //get in the right order for fontawesome??
        btnMicrophoneToggle.classList.remove("fa-microphone"); btnMicrophoneToggle.classList.add("fa-microphone-slash");

        if (call !== undefined) {
            LogConsole("mute call");
            call.mute();
        }

    }
}

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
    }
};


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
    let array = data.split(':');
    let len = array.length;
    return array[len - 1];
};

async function Login() {
    let name = document.getElementById("user-name").value;
    setCookie("name", name);
    document.getElementById("call-panel").classList.remove("hidden");
    $('#modal-login').modal('hide');
    await Init();
};

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
            }
            if (remoteParticipant.state === 'Disconnected') {
                //Remote Participant hung up so remove the element
                DestroyRemoteParticpantElement(id);
                ShowParticipantList();
            }
        });

        // Inspect the remoteParticipants current videoStreams and subscribe to them.
        remoteParticipant.videoStreams.forEach(async (remoteVideoStream) => {
            await subscribeToRemoteVideoStream(remoteParticipant, remoteVideoStream)
        });
        // Subscribe to the remoteParticipant's 'videoStreamsUpdated' event to be
        // notified when the remoteParticipant adds new videoStreams and removes video streams.
        remoteParticipant.on('videoStreamsUpdated', e => {
            // Subscribe to new remote participant's video streams that were added.
            e.added.forEach(async (remoteVideoStream) => {
                LogConsole("subscribing to remote video stream");
                await subscribeToRemoteVideoStream(remoteParticipant, remoteVideoStream);

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
async function subscribeToRemoteVideoStream(remoteParticipant, remoteVideoStream) {
    remoteVideoStream.on('isAvailableChanged', async () => {
        let id = GetId(remoteParticipant.identifier.communicationUserId);
        LogConsole(`visibility changed for ${id}`, remoteVideoStream.isAvailable);
        // Participant has switched video on.
        if (remoteVideoStream.isAvailable) {
            LogConsole("remote participant is now available for " + remoteParticipant.displayName, remoteParticipant);
            //await CreateRemoteParticipantElement(id, remoteParticipant.displayName);
            await DisplayRemoteVideo(id, remoteVideoStream);

            // Participant has switched video off.
        } else {
            DestroyRemoteParticipantVideo(id);
        }
    });

    // Participant has video on initially.
    if (remoteVideoStream.isAvailable) {
        let id = GetId(remoteParticipant.identifier.communicationUserId);
        await DisplayRemoteVideo(id, remoteVideoStream);
    }
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
    LogConsole("Mobile Browser: is " + a);
    return a;
}

export { getCookie, setCookie };

