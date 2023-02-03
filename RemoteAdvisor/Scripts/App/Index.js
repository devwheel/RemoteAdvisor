import { CallClient, CallAgent, LocalVideoStream, Call, AudioDeviceInfo, VideoDeviceInfo, RemoteParticipant, VideoStreamRenderer } from "@azure/communication-calling";
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

let lastCamera = 0;
let lastMicrophone = 0;
let lastSpeaker = 0;

const hangUpButton = document.getElementById("hang-up-button");
const joinButton = document.getElementById("video-button");
const videoElement = document.getElementById("video");
const refreshElement = document.getElementById("refresh-participants");
const loginButton = document.getElementById("btnLogin");
const consoleOut = document.getElementById("console-out");
const remoteDisplay = document.getElementById("remote-displays");
const participantCount = document.getElementById("call-participants");
const callState = document.getElementById("call-state");

const cameraDropdown = document.getElementById("camera-list");
const microphoneDropdown = document.getElementById("mic-list");
const speakerDropdown = document.getElementById("speaker-list");

const localVideoSwitch = document.getElementById("local-video-switch");
const localMicrophoneSwitch = document.getElementById("local-microphone-switch");


const groupId = '9fef326a-b48c-43e3-8ceb-a19025bc2779';

document.addEventListener('DOMContentLoaded', startup);

loginButton.addEventListener("click", async () => LoginOK(), false);  //Login

async function startup() {

    $('#modal-login').on('shown.bs.modal', function () {
        $('#user-name').trigger('focus')
    })

    let name = GetUserName();
    console.log("name: " + name)
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
    console.log(tokenResponse);
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
    console.log("creating call agent for " + displayName);
    callAgent = await callClient.createCallAgent(tokenCredential, { displayName: displayName });

    //Get the device manager
    deviceManager = await callClient.getDeviceManager();

    //Browser consent
    await deviceManager.askDevicePermission({ video: true, audio: true });

    //Load Device Dropdowns with Devices
    await LoadDeviceDropdowns(deviceManager);

    //Set UX Elements to Show
    document.getElementById('local-panel').style.display = 'block';
    document.getElementById('partipant-list').style.display = 'block';
    document.getElementById('media-selectors').style.display = 'block';
    joinButton.disabled = false;

}

//********************************************************************* */
//  Join the Meeting with Video
//********************************************************************* */
async function JoinVideo() {
    // Turn on Video if it is not there
    if (localVideoStream === undefined) {
        localVideoStream = new LocalVideoStream(GetActiveCamera());
        myCameraMuted = true;
        await ToggleVideo(); //need to fix
    }
    const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: myMicrophoneMuted } };
    const context = { groupId: groupId };   //context of the call Group/Teams/Room/etc

    //Setup the call/meeting
    call = callAgent.join(context, placeCallOptions);
    console.log("call", call);
    // Configure all the call events/callbacks
    await subscribeToCall(call);

    document.getElementById('call-info').style.display = 'block'
    ShowCallState(call);  //Connecting..=> connected

    //UX Settings for a connected call
    hangUpButton.disabled = false;
    hangUpButton.style.display = 'block';
    joinButton.disabled = false;
};

async function LoadDeviceDropdowns(deviceMgr) {
    //get all the camera devices
    cameras = await deviceMgr.getCameras();
    //add the cameras to the dropdown list
    let cameraSelector = document.getElementById('camera-list');
    let i = 0;
    cameras.forEach(camera => {
        let option = document.createElement('option');
        option.value = camera.id;
        option.innerHTML = camera.name;
        if (camera.id === lastCamera) {
            option.selected = true;
        }
        cameraSelector.appendChild(option);
        i++;
    });

    //cameraSelector.options[cameraSelector.options.length - 1]

    document.getElementById('cameras').style.display = 'block';

    //get all the mics
    microphones = await deviceMgr.getMicrophones();
    //add the mics to the dropdown list
    let micSelector = document.getElementById('mic-list');
    i = 0;
    microphones.forEach(mic => {
        let option = document.createElement('option');
        option.value = mic.id;
        option.innerHTML = mic.name;
        if (i === lastMicrophone) {
            option.selected = true;
        }
        micSelector.appendChild(option);
        i++;
    });
    // micSelector.options[micSelector.options.length - 1]
    document.getElementById('mics').style.display = 'block';

    //get all the speakers
    speakers = await deviceMgr.getSpeakers();
    //add the mics to the dropdown list
    let speakerSelector = document.getElementById("speaker-list");
    i = 0;
    speakers.forEach((speaker) => {
        let option = document.createElement('option');
        option.value = speaker.id;
        option.innerHTML = speaker.name;
        if (i === lastSpeaker) {
            option.selected = true;
        }
        speakerSelector.appendChild(option);
        i++;
    });

    // speakerSelector.options[speakerSelector.options.length - 1]
    document.getElementById('speakers').style.display = 'block';


    SetupListeners();

};

function ShowParticipantList() {

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
    var participants = call.remoteParticipants;


    participants.forEach(part => {
        part.videoStreams.forEach((stream) => {
            if (stream.type === 'Video') {
                UpdateRemoteParticipantName(GetId(part.identifier.communicationUserId), part.displayName);
                console.log("video part identifier:", part.identifier);
            }
        });

        let option = document.createElement('option');
        option.innerHTML = part.displayName;

        partElement.appendChild(option);

    });

};

async function DisplayRemoteVideo(id, stream) {
    LogConsole("Trying to display Remote Video");
    let renderer = new VideoStreamRenderer(stream);
    let view = await renderer.createView();
    //FIX THIS as the doc manipution seems to break the video
    document.getElementById(id).appendChild(view.target);
}

async function DisplayLocalVideo() {
    if (localView === undefined) {
        if (localVideoStream === undefined) {
            activeCamera = await GetActiveCamera();
            localVideoStream = new LocalVideoStream(activeCamera);
        }
        let renderer = new VideoStreamRenderer(localVideoStream);
        localView = await renderer.createView();
        console.log("localView", localView);
        videoElement.appendChild(localView.target);
        document.getElementById("local-video-switch").setAttribute("data-value", "on");
        return localVideoStream;
    }
};

async function GetActiveCamera() {
    let list = document.getElementById("camera-list");
    let cameraId = list.value;

    let cameras = await deviceManager.getCameras();
    let camera = cameras.filter(cam => cam.id == cameraId)[0];
    return camera;
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
    joinButton.addEventListener("click", async () => JoinVideo(), false);

    //refresh participants
    refreshElement.addEventListener("click", () => {
        if (call !== undefined) {
            ShowParticipantList();
        } else {
            alert('there is no call');
        }
    });

    //change camera
    cameraDropdown.addEventListener("change", async () => {
        let cameraId = document.getElementById("camera-list").value;
        setCookie("camera", cameraId);
        let camDeviceInfo = cameras.filter(cam => cam.id == cameraId)[0];
        if (localVideoStream !== undefined) {
            localVideoStream.switchSource(camDeviceInfo);
        }
    });

    //change microphone
    microphoneDropdown.addEventListener("change", async () => {
        let micIndex = document.getElementById("mic-list").selectedIndex;
        let micDeviceInfo = microphones[micIndex];
        setCookie("microphone", micIndex);
        await deviceManager.selectMicrophone(micDeviceInfo);

    });

    //change speaker
    speakerDropdown.addEventListener("change", async () => {
        let speakerIndex = document.getElementById("speaker-list").selectedIndex;
        let speakerDeviceInfo = speakers[speakerIndex];
        setCookie("speaker", speakerIndex);
        await deviceManager.selectMicrophone(speakerDeviceInfo);
    });

    //hangup the call
    hangUpButton.addEventListener("click", async () => {

        // end the current call
        await call.stopVideo(localVideoStream);
        call.hangUp({ forEveryone: false });
        localView.dispose();

        //let remotePannel =  document.querySelector("remote-panel");
        let remotePannel = document.querySelector("#remote-displays .remote-panel")
        if (remotePannel !== null) {
            remotePannel.remove();
        }
        // $("#remote-displays").find($(".remote-panel")).remove();
        /// remotePannel.remove();

        // toggle button states
        hangUpButton.disabled = true;
        document.getElementById("hang-up-button").style.display = 'none';

        joinButton.disabled = true;
    });

    //toggle local video
    localVideoSwitch.addEventListener("click", async () => {

        await ToggleVideo();
    });

    //toggle mute
    localMicrophoneSwitch.addEventListener("click", () => {
        let status = document.getElementById("local-microphone-switch").getAttribute("data-value");
        let mic = document.getElementById("local-microphone-switch")

        if (status === "off") {

            mic.classList.remove("inactive-control");
            mic.classList.add("active-control");
            mic.setAttribute("data-value", "on");
            document.getElementById("my-mic-on").classList.remove("hidden");
            document.getElementById("my-mic-off").classList.add("hidden");
            myMicrophoneMuted = false;
            if (call !== undefined) {
                console.log("unmute call");
                call.unmute();
            }
        } else {

            mic.classList.remove("active-control");
            mic.classList.add("inactive-control");
            mic.setAttribute("data-value", "off");
            document.getElementById("my-mic-on").classList.add("hidden");
            document.getElementById("my-mic-off").classList.remove("hidden");

            myMicrophoneMuted = true;
            if (call !== undefined) {
                console.log("mute call");
                call.mute();
            }

        }

    });

};

async function ToggleVideo() {
    let videoSwitch = document.getElementById("local-video-switch")
    console.log('starting video toggle');
    if (myCameraMuted) {
        //Turn on Video
        videoSwitch.classList.remove("inactive-control");
        videoSwitch.classList.add("active-control");
        document.getElementById("my-cam-on").classList.remove("hidden");
        document.getElementById("my-cam-off").classList.add("hidden");

        if (localVideoStream === undefined) {
            localVideoStream = await DisplayLocalVideo();
        }
        else {
            console.log("loca video stream exists, appending to local video element: ", localVideoStream)
            videoElement.appendChild(localView.target);
        }

        if (call !== undefined) {
            console.log("starting video on call", call);
            await call.startVideo(localVideoStream);
        }
        myCameraMuted = false;
    } else {
        //turn off video

        try {
            if (call !== undefined) {
                console.log("stopping video on call", call);
                await call.stopVideo(localVideoStream);

            }
        } catch (e) {
            console.log("toggle off error" + e);
        }
        videoSwitch.classList.remove("active-control");
        videoSwitch.classList.add("inactive-control");
        document.getElementById("my-cam-on").classList.add("hidden");
        document.getElementById("my-cam-off").classList.remove("hidden");
        myCameraMuted = true;
        if (localView.target != null) {
            videoElement.removeChild(localView.target);
        }

    }
};

function ShowCallState(e) {
    //  let icon = "<i class='fas fa-phone-alt'></i>";
    //might do something here later
    if (e.state !== undefined) {
        switch (e.state) {
            case 'None':
                break;
            case 'Incoming':
                break;
            case 'Connecting':
                break;
            case 'Ringing':
                break;
            case 'Connected':
                break;
            case 'Hold':
                break;
            case 'InLobby':
                break;
            case 'Disconnecting':
                break;
            case 'Disconnected':
                break;
            case 'EarlyMedia':
                break;
            default:
                break;
        }
        document.getElementById("call-state").innerText = call.state;
    }
};

async function CreateRemoteParticipantElement(id, userName) {
    console.log("creating remote box for " + userName);
    let remoteElement = document.getElementById("remote-" + id);
    if (remoteElement !== null) {
        return;
    }

    let newElement = '<h5 class="drag-bar">Remote Participant Video</h5><div  class="video-card"><div id="' + id + '" class="video-panel"></div><div id="remote-video-bar" class="toolbar"><div id="remote-name-' + id + '" class="form-group form-inline">' + userName + '</div></div>';

    let remoteDisplays = document.getElementById('remote-displays');
    var remoteEl = document.createElement("div");
    remoteEl.id = "remote-" + id;
    remoteEl.classList.add("col-5");
    remoteEl.classList.add("formal-section");
    remoteEl.classList.add("video-card-holder");
    remoteEl.classList.add("remote-panel");
    remoteEl.innerHTML = newElement;
    remoteDisplays.append(remoteEl);
    return id;
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
        // Inspect the initial call.id value.
        LogConsole(`Subscribing to Call: ${call.id}`);
        //Subscribe to call's 'idChanged' event for value changes.
        call.on('idChanged', () => {
            LogConsole(`Call Id changed: ${call.id}`);
        });

        // Inspect the initial call.state value.
        LogConsole(`Call state: ${call.state}`);
        // Subscribe to call's 'stateChanged' event for value changes.
        call.on('stateChanged', async () => {
            ShowCallState(call);
            LogConsole(`Call state changed: ${call.state}`);
            if (call.state === 'Connected') {
                hangUpButton.disabled = false;
                joinButton.disabled = true;
                //stopjoinButton.disabled = false
            } else if (call.state === 'Disconnected') {
                joinButton.disabled = false;
                LogConsole(`Call ended, call end reason={code=${call.callEndReason.code}, subCode=${call.callEndReason.subCode}}`);
            }
        });
        // Show the local Video Stream
        call.localVideoStreams.forEach(async (lvs) => {
            LogConsole("show the local video")
            localVideoStream = lvs;
            await DisplayLocalVideo()
        });

        // Handle the local video stream updated
        LogConsole("Listening for localVideoStreamsUpdated")
        call.on('localVideoStreamsUpdated', e => {
            LogConsole("local video stream updated", e);
            e.added.forEach(async (lvs) => {
                localVideoStream = lvs;
                await DisplayLocalVideo();
            });
            e.removed.forEach(lvs => {
                removeLocalVideoStream();
            });
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
            LogConsole(`Remote participant state changed: ${remoteParticipant.state}`);
            if (remoteParticipant.state === 'Connected') {
                let id = GetId(remoteParticipant.identifier.communicationUserId);
                await CreateRemoteParticipantElement(id, remoteParticipant.displayName);
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
    // Create a video stream renderer for the remote video stream.
    let videoStreamRenderer = new VideoStreamRenderer(remoteVideoStream);
    let view;

    remoteVideoStream.on('isAvailableChanged', async () => {
        // Participant has switched video on.
        if (remoteVideoStream.isAvailable) {
            console.log(remoteParticipant);
            let id = GetId(remoteParticipant.identifier.communicationUserId);
            await CreateRemoteParticipantElement(id, remoteParticipant.displayName);
            await DisplayRemoteVideo(id, remoteVideoStream);

            // Participant has switched video off.
        } else {
            if (view) {
                view.dispose();
                view = undefined;
            }
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

}
export { getCookie, setCookie };
