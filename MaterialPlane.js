//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Global variables
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import { registerSettings } from "./src/Misc/settings.js";
import { sendWS,startWebsocket } from "./src/websocket.js";
import { calibrationForm, calibrationProgressScreen, removeOverlay } from "./src/calibration.js";
import { registerLayer } from "./src/Misc/misc.js";
import { baseSetup } from "./src/IRtoken/baseSetup.js";
import { initializeIRtokens, initializeCursors, setLastBaseAddress } from "./src/analyzeIR.js";

export const moduleName = "MaterialPlane";
export let lastToken;
export let lastTokenSceneName;

let hideElements = false;
let enableModule = false;

export let calibrationDialog;
export let calibrationProgress;

export let hwVariant;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Functions
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function setHwVariant(v) {
    hwVariant = v;
}

/**
 * Check keys for 'Ctrl' press, to show or hide elements
 */

function checkKeys() {
    let fired = false;
    window.addEventListener("keydown", async (e) => { 
      if (fired){
        fired = false;
        if (hideElements){
            $('#logo').hide();
            $('#sidebar').hide();
            $('#navigation').hide();
            $('#controls').hide();
            $('#players').hide();
            $('#hotbar').hide();
        }
      }
      else if (e.key == "Control") {
        fired = true;
        if (hideElements){
            $('#logo').show();
            $('#sidebar').show();
            $('#navigation').show();
            $('#controls').show();
            $('#players').show();
            $('#hotbar').show();
        }
        
      }
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Hooks
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Ready hook
 * Attempt to open the websocket
 */
Hooks.on('ready', ()=>{
    enableModule = (game.user.name == game.settings.get(moduleName,'TargetName')) ? true : false;
    hideElements = game.settings.get(moduleName,'HideElements') && game.user.isGM == false;
    if (game.settings.get(moduleName,'Enable') && window.location.protocol == "https:"){
        ui.notifications.warn("Material Plane: "+game.i18n.localize("MaterialPlane.Notifications.SSL"));
        enableModule = false;
        return;
    }
    if (enableModule || game.user.isGM){
        startWebsocket();

        if (hideElements){
            $('#logo').hide();
            $('#sidebar').hide();
            $('#navigation').hide();
            $('#controls').hide();
            $('#players').hide();
            $('#hotbar').hide();
            checkKeys();
        }

    }

    game.socket.on(`module.MaterialPlane`, (payload) =>{
        //console.log(payload);
        
        if (game.user.id == payload.receiverId) {
            if (payload.msgType == "moveToken"){
                let token = canvas.tokens.children[0].children;
                for (let i=0; i<token.length; i++) {
                    if (token[i].id == payload.tokenId){
                        let tokenSel = token[i];
                        tokenSel.update({x: payload.newCoords.x, y: payload.newCoords.y});
                    }
                }
            }
        }
        if (game.user.isGM) {
            if (payload.msgType == "controlToken") {
                lastToken = game.canvas.tokens.get(payload.tokenId);
                lastTokenSceneName = payload.lastTokenSceneName;

                if (document.getElementById("MPbaseSetup") != null) {
                    document.getElementById("MP_lastTokenName").value=lastToken.name;
                    document.getElementById("MP_lastTokenActorName").value=lastToken.actor.name;
                    document.getElementById("MP_lastTokenSceneName").value=lastTokenSceneName;
                }
            }
            else if (payload.msgType == "lastBaseAddress") {
                const lastBaseAddress = payload.lastBaseAddress;
                setLastBaseAddress(lastBaseAddress);
                if (document.getElementById("MP_lastBaseAddress") != null) {
                    document.getElementById("MP_lastBaseAddress").value=lastBaseAddress;
                    for (let i=0; i<99; i++) {
                        let base = document.getElementById("baseId-"+i);
                        if (base != null) {
                            if (lastBaseAddress == base.value) base.style.color="green";
                            else base.style.color="";
                        }
                        
                    }
                }
            }
            else if (payload.msgType == "setOffset") {
                game.settings.set(moduleName, 'offset',payload.offset)
            }
        }    
    });
    
    if (game.user.isGM) game.settings.set(moduleName,'menuOpen',false);

    initializeIRtokens();
    initializeCursors();
});

Hooks.on("renderSidebarTab", (app, html) => {
    enableModule = (game.user.name == game.settings.get(moduleName,'TargetName')) ? true : false;
    if (enableModule == false && game.user.isGM == false) return;
    
    //Create labels and buttons in sidebar
    if (app.options.id == 'settings') {
        const label = $(
            `<h2>Material Plane</h2>`
        );
        const btnCal = $(
            `<button id="MaterialPlane_Calibration" data-action="MaterialPlane_Cal" title="Calibration Menu">
                <i></i> ${game.i18n.localize("MaterialPlane.CalSett.BtnName")}
            </button>`
        );
    
        const setupButton = html.find("div[id='settings-game']");
        setupButton.after(label);
        label.after(btnCal);
    
        btnCal.on("click", event => {
            calibrationDialog.render(true)
        });
    }
    else if (app.options.id == 'actors') {
        
        if (game.user.isGM == false) return;

        const btnBaseSetup = $(
            `
            <div class="header-actions action-buttons flexrow">
                <button id="MaterialPlane_BaseSetup">
                    <i></i> ${game.i18n.localize("MaterialPlane.BaseSetup.BtnName")}
                </button>
            </div>
            `
        );
        html.find(".directory-header").prepend(btnBaseSetup);
        btnBaseSetup.on("click",event => {
            let dialog = new baseSetup();
            dialog.render(true);
        });
    }
});


Hooks.on('closecalibrationForm',() => {
    calibrationDialog.setMenuOpen(false)
});

Hooks.on('closecalibrationProgressScreen',() => {
    removeOverlay();
    calibrationProgress.setCalibrationRunning(false)
    console.log('stopping calibration')
    let msg = "CAL CANCEL ";
    sendWS(msg);
});

/**
 * Init hook
 * Initialize settings
 */
Hooks.once('init', function(){
    registerSettings(); //in ./src/settings.js
    registerLayer();
    calibrationDialog = new calibrationForm();
    calibrationProgress = new calibrationProgressScreen();    
});


/**
 * Hide elements on various hooks
 */
Hooks.on('renderSceneNavigation', (app,html) => {
    if (hideElements) {
        html.hide();
    }
});

Hooks.on('renderSceneControls', (app, html) => {
    if (hideElements) {
        html.hide();
    }
});

Hooks.on('renderSidebarTab', (app, html) => {
    if (hideElements) {
        html.hide();
    }
});

Hooks.on('renderCombatTracker', (app, html) => {
    if (hideElements) {
        html.hide();
    }
});

Hooks.on('renderPlayerList', (app, html) => {
    if (hideElements) {
        html.hide();
    }
});

Hooks.on('canvasReady', (canvas) => {
   // canvas.stage.addChild(circle);
    //circle.init();
})

Hooks.on('controlToken', (token,controlled) => {
    if (!controlled) return;

    lastToken = token;
    lastTokenSceneName = canvas.scene.name;

    const payload = {
        msgType: "controlToken",
        tokenId: lastToken.id,
        lastTokenSceneName
    }
    game.socket.emit(`module.MaterialPlane`, payload);

    if (document.getElementById("MPbaseSetup") != null) {
        document.getElementById("MP_lastTokenName").value=token.name;
        document.getElementById("MP_lastTokenActorName").value=token.actor.name;
        document.getElementById("MP_lastTokenSceneName").value=canvas.scene.name;
    }
})