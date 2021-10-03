import { CallClient, CallAgent, LocalVideoStream, Call, AudioDeviceInfo, VideoDeviceInfo, RemoteParticipant, Renderer } from "@azure/communication-calling";
import { AzureCommunicationUserCredential, getIdentifierKind } from '@azure/communication-common';
import {getCookie, setCookie} from './Cookies.js'

let callClient;
let deviceManager;
let callAgent;
let call;

let localVideoStream;
let localView;


let myCameraMuted = true;
let myMicrophoneMuted = true;

let lastCamera = 0;
let lastMicrophone = 0;
let lastSpeaker = 0;


const hangUpButton = document.getElementById("hang-up-button");
const vidButton = document.getElementById("video-button");
const videoElement = document.getElementById("video");
const refreshElement = document.getElementById("refresh-participants");

const cameraDropdown = document.getElementById("camera-list");
const microphoneDropdown = document.getElementById("mic-list");
const speakerDropdown = document.getElementById("speaker-list");

const localVideoSwitch = document.getElementById("local-video-switch");
const localMicrophoneSwitch = document.getElementById("local-microphone-switch");


const groupId = '9fef326a-b48c-43e3-8ceb-a19025bc2777';

document.addEventListener('DOMContentLoaded', startup);

async function startup() {

    $('#modal-login').on('shown.bs.modal', function () {
        $('#user-name').trigger('focus')
    })

    let name = getCookie("name");
    if (name === null) {
        $('#modal-login').modal('show');
    } else {
        $("#login-name").val(name);
        $("#call-panel").removeClass("hidden");
    }


    LoadSettings();
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

        document.getElementById('local-panel').style.display = 'block';
        document.getElementById('partipant-list').style.display = 'block';
        document.getElementById('media-selectors').style.display = 'block';;

    }).catch(error => {

        alert("Error creating meeting : " + error.responseText);
    });

}

const JoinVideo = async () => {
    //setup the video device to be used
    if (localVideoStream === undefined) {
        //localVideoStream = new LocalVideoStream(GetActiveCamera());
        //myCameraMuted = true;
        await ToggleVideo();
    }
    const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: myMicrophoneMuted } };
    const context = { meetingLink: groupId };


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

const processNewVideoSteams = (participant, newStreams) => {
    console.log(newStreams);
    if (!newStreams || newStreams.length === 0) {
        return;
    }
    for (let addedStream of newStreams) {
        if (addedStream.type !== 'Video') {
            return;
        }
        if (addedStream.isAvailable) {
            CreateRemoteParticipantElement(participant);
            DisplayRemoteVideo(participant, addedStream);
            return;
        }
    }
};

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

const LoadDeviceDropdowns = (deviceMgr) => {
    //get all the camera devices
    let cameraList = deviceMgr.getCameraList();
    //add the cameras to the dropdown list
    let cameraSelector = document.getElementById('camera-list');
    let i = 0;
    cameraList.forEach(camera => {
        let option = document.createElement('option');
        option.value = camera.id;
        option.innerHTML = camera.name;
        if (i === lastCamera) {
            option.selected = true;
        }
        cameraSelector.appendChild(option);
        i++;
    });

    //cameraSelector.options[cameraSelector.options.length - 1]

    document.getElementById('cameras').style.display = 'block';

    //get all the mics
    let micList = deviceMgr.getMicrophoneList();
    //add the mics to the dropdown list
    let micSelector = document.getElementById('mic-list');
    i = 0;
    micList.forEach(mic => {
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
    let speakerList = deviceMgr.getSpeakerList();
    //add the mics to the dropdown list
    let speakerSelector = document.getElementById("speaker-list");
    i = 0;
    console.log("last speaker: " + lastSpeaker);
    speakerList.forEach((speaker) => {

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

const ShowParticipantList = () => {

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
                console.log(part.identifier);
            }
        });

        let option = document.createElement('option');
        option.innerHTML = part.displayName;

        partElement.appendChild(option);

    });

};

async function DisplayRemoteVideo(User, stream) {
    let id = GetId(User.identifier.communicationUserId);
    let targetElement = User.identifier.communicationUserId;
    let renderer = new Renderer(stream);
    var view = await renderer.createView();
    //FIX THIS as the doc manipution seems to break the video
    document.getElementById(id).appendChild(view.target);
}

const DisplayLocalVideo = async () => {
    if (localView === undefined) {
        if (localVideoStream === undefined) {
            localVideoStream = new LocalVideoStream(GetActiveCamera());
        }
        const placeCallOptions = { videoOptions: { localVideoStreams: [localVideoStream] }, audioOptions: { muted: myMicrophoneMuted } };
        let renderer = new Renderer(localVideoStream);
        localView = await renderer.createView();
        videoElement.appendChild(localView.target);
        document.getElementById("local-video-switch").setAttribute("data-value", "on");
        return localVideoStream;
    }
};

const GetActiveCamera = () => {
    let list = document.getElementById("camera-list");
    let cameraIndex = list.selectedIndex;
    const videoDeviceInfo = deviceManager.getCameraList()[cameraIndex];
    return videoDeviceInfo;
};

const LoadSettings = () => {
    //see if a different camera was set
    let cameraCheck = getCookie("camera");
    if (cameraCheck !== null) {
        lastCamera = parseInt(cameraCheck);
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

const SetupListeners = () => {

    //join video
    vidButton.addEventListener("click", async () => JoinVideo(), false);

    //refresh participants
    refreshElement.addEventListener("click", () => {
        console.log('remote participants');
        if (call !== undefined) {
            ShowParticipantList();
        } else {
            alert('there is no call');
        }
    });

    //change camera
    cameraDropdown.addEventListener("change", async () => {
        let cameraIndex = document.getElementById("camera-list").selectedIndex;
        setCookie("camera", cameraIndex);
        const camDeviceInfo = deviceManager.getCameraList()[cameraIndex];
        if (localVideoStream !== undefined) {
            localVideoStream.switchSource(camDeviceInfo);
        }
    });

    //change microphone
    microphoneDropdown.addEventListener("change", async () => {
        let micIndex = document.getElementById("mic-list").selectedIndex;
        const micDeviceInfo = deviceManager.getMicrophoneList()[micIndex];
        setCookie("microphone", micIndex);
        deviceManager.setMicrophone(micDeviceInfo);

    });

    //change speaker
    speakerDropdown.addEventListener("change", async () => {
        let speakerIndex = document.getElementById("speaker-list").selectedIndex;
        const speakerDeviceInfo = deviceManager.getMicrophoneList()[speakerIndex];
        setCookie("speaker", speakerIndex);
        deviceManager.setMicrophone(speakerDeviceInfo);
    });

    //hangup the call
    hangUpButton.addEventListener("click", async () => {

        // end the current call
        await call.stopVideo(localVideoStream);
        call.hangUp({ forEveryone: false });
        localView.dispose();

        //let remotePannel =  document.querySelector("remote-panel");
        let remotePannel = document.querySelector("#remote-displays .remote-panel")
        if (remotePannel !== null) 
        {
            remotePannel.remove();
        }
        // $("#remote-displays").find($(".remote-panel")).remove();
        /// remotePannel.remove();

        // toggle button states
        hangUpButton.disabled = true;
        document.getElementById("hang-up-button").style.display = 'none';

        vidButton.disabled = false;
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

const ShowCallState = (e) => {
    //  let icon = "<i class='fas fa-phone-alt'></i>";
    //might do something here later
    switch (e) {
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
};

const CreateRemoteParticipantElement = (User) => {
    let id = GetId(User.identifier.communicationUserId);

    let remoteElement = document.getElementById("remote-" + id);
    if (remoteElement !== null) {
        return;
    }
    console.log(remoteElement);

    let userName = User.displayName;
    //    let newElement = '<div id="remote-' + id + '" class="col-5 formal-section video-card-holder remote-panel"><h5 class="drag-bar">Remote Participant Video</h5><div  class="video-card"><div id="' + id + '" class="video-panel"></div><div id="remote-video-bar" class="toolbar"><div id="remote-name-' + id + '" class="form-group form-inline">' + userName + '</div></div></div>';
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

    //remoteDisplays.innerHTML = remoteDisplays.innerHTML + newElement;

    //$("#remote-displays").append(newElement);

    // $("#remote-" + id).draggable({stack:"div"});
    return id;
};

const UpdateRemoteParticipantName = (userId, name) => {
    document.getElementById("remote-name-" + userId).innerHTML = name;
};

const GetId = (data) => {
    let array = data.split(':');
    let len = array.length;
    return array[len - 1];
};

export { getCookie, setCookie };
