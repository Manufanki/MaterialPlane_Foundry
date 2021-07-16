import * as MODULE from "../MaterialPlane.js";
import { lastBaseAddress } from "./websocket.js";
import { lastToken, lastTokenSceneName } from "../MaterialPlane.js";

export const registerSettings = function() {
    game.settings.register(MODULE.moduleName,'baseSetup', {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });
    
/**
     * Enables the module (world)
     */
    game.settings.register(MODULE.moduleName,'Enable', {
        name: "MaterialPlane.Sett.En",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
        onChange: x => window.location.reload()
    });

    /**
     * Sets the movement method
     */
    game.settings.register(MODULE.moduleName,'movementMethod', {
        name: "MaterialPlane.Sett.MovementMethod",
        hint: "MaterialPlane.Sett.MovementMethod_Hint",
        scope: "world",
        config: true,
        type:Number,
        default:1,
        choices:["MaterialPlane.Sett.MovementMethod_Default","MaterialPlane.Sett.MovementMethod_Live","MaterialPlane.Sett.MovementMethod_SbS"]
    });

    /**
     * Release the token after dropping
     */
    game.settings.register(MODULE.moduleName,'deselect', {
        name: "MaterialPlane.Sett.Deselect",
        hint: "MaterialPlane.Sett.Deselect_Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    /**
     * Draw movement marker
     */
     game.settings.register(MODULE.moduleName,'movementMarker', {
        name: "MaterialPlane.Sett.MovementMarker",
        hint: "MaterialPlane.Sett.MovementMarker_Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    /**
     * Sets if the target client is allowed to move non-owned tokens
     */
    game.settings.register(MODULE.moduleName,'EnNonOwned', {
        name: "MaterialPlane.Sett.NonownedMovement",
        hint: "MaterialPlane.Sett.NonownedMovement_Hint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    /**
     * Hides all elements on the target client, if that client is not a GM
     */
    game.settings.register(MODULE.moduleName,'HideElements', {
        name: "MaterialPlane.Sett.HideDisplay",
        hint: "MaterialPlane.Sett.HideDisplay_Hint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: x => window.location.reload()
    });

    
    /**
     * Sets the name of the target client (who has the TV connected)
     */
     game.settings.register(MODULE.moduleName,'TargetName', {
        name: "MaterialPlane.Sett.TargetName",
        hint: "MaterialPlane.Sett.TargetName_Hint",
        scope: "world",
        config: true,
        default: "Observer",
        type: String,
        onChange: x => window.location.reload()
    });

    /**
     * Sets the name of the target client (who has the TV connected)
     */
    game.settings.register(MODULE.moduleName,'IP', {
        name: "MaterialPlane.Sett.SensorIP",
        hint: "MaterialPlane.Sett.SensorIP_Hint",
        scope: "world",
        config: true,
        default: "192.168.1.189",
        type: String,
        onChange: x => window.location.reload()
    });

    //invisible settings
    game.settings.register(MODULE.moduleName,'menuOpen', {
        name: "Menu Open",
        hint: "Menu open on GM side",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    });


}

export class baseSetup extends FormApplication {
    constructor(data, options) {
        super(data, options);
        this.data = {};
        this.baseSettings = [];
        this.update = false;
    }
  
    /**
     * Default Options for this FormApplication
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "MPbaseSetup",
            title: "Material Plane: "+game.i18n.localize("MaterialPlane.BaseSetup.Title"),
            template: "./modules/MaterialPlane/templates/baseSetup.html",
            height: "auto"
        });
    }
  
    /**
     * Provide data to the template
     */
    getData() {
        if (this.update == false) this.baseSettings = game.settings.get(MODULE.moduleName,'baseSetup');
        this.update = false;

        let bases = [];

        for (let i=0; i<this.baseSettings.length; i++){
            const setting = this.baseSettings[i];
            let tokenName = this.baseSettings[i].tokenName ? this.baseSettings[i].tokenName : "";

            let sceneName = this.baseSettings[i].sceneName ? this.baseSettings[i].sceneName : "";
            if (setting.linkActor)  {
                tokenName = "any";
                sceneName = "any";
            }
            
            const baseData = {
                iteration: i,
                baseId: setting.baseId,
                tokenName: tokenName,
                sceneName: sceneName,
                actorName: this.baseSettings[i].actorName ? this.baseSettings[i].actorName : "",
                linkActor: setting.linkActor,
                disabled: setting.linkActor ? "disabled" : "",
                color: setting.baseId == lastBaseAddress ? "green" : ""
            }
            bases.push(baseData);
        }
        this.data.length = this.baseSettings.length;
        this.data.bases = bases;
        const tokenName = lastToken?.name ? lastToken.name : "";
        const actorName = lastToken?.actor?.name ? lastToken.actor.name : "";
        const sceneName = lastTokenSceneName ? lastTokenSceneName : "";
       
        return {
            length: this.baseSettings.length,
            bases: bases,
            lastBaseAddress: lastBaseAddress,
            lastTokenName: tokenName,
            lastTokenActorName: actorName,
            lastTokenSceneName: sceneName
        } 
    }
  
    /**
     * Update on form submit
     * @param {*} event 
     * @param {*} formData 
     */
    async _updateObject(event, formData) {
 
    }
  
    activateListeners(html) {
        super.activateListeners(html);
        
        const baseId = html.find("input[name='baseId']");
        const tokenName = html.find("input[name='tokenName']");
        const sceneName = html.find("input[name='sceneName']");
        const actorName = html.find("input[name='actorName']");
        const linkActor = html.find("input[name='linkActor']");
        const setIdBtn = html.find("button[name='setId']");
        const setDataBtn = html.find("button[name='setData']");
        const deleteBtn = html.find("button[name='delete']");
        const addBtn = html.find("button[name='add']");

        baseId.on("change",(event)=>{  
            const iteration = event.target.id.replace('baseId-','');
            this.baseSettings[iteration].baseId = event.target.value;
            if (event.target.value == html.find("input[id='MP_lastBaseAddress']")[0].value) html.find("input[id='baseId-" + iteration + "']")[0].style.color="green";
            this.updateSettings(this.baseSettings);
        });

        tokenName.on("change",(event)=>{  
            const iteration = event.target.id.replace('tokenName-','');
            this.baseSettings[iteration].tokenName = event.target.value;
            this.updateSettings(this.baseSettings);
        });

        sceneName.on("change",(event)=>{  
            const iteration = event.target.id.replace('sceneName-','');
            this.baseSettings[iteration].sceneName = event.target.value;
            this.updateSettings(this.baseSettings);
        });

        actorName.on("change",(event)=>{  
            const iteration = event.target.id.replace('actorName-','');
            this.baseSettings[iteration].actorName = event.target.value;
            this.updateSettings(this.baseSettings);
        });

        linkActor.on("change",(event)=>{  
            const iteration = event.target.id.replace('linkActor-','');
            const linkActor = event.target.checked;
            this.baseSettings[iteration].linkActor = linkActor;
            if (linkActor) {
                html.find("input[id='tokenName-" + iteration + "']")[0].value = "any";
                html.find("input[id='tokenName-" + iteration + "']")[0].disabled = true;
                html.find("input[id='sceneName-" + iteration + "']")[0].value = "any";
                html.find("input[id='sceneName-" + iteration + "']")[0].disabled = true;
            }
            else {
                html.find("input[id='tokenName-" + iteration + "']")[0].value = this.baseSettings[iteration].tokenName ? this.baseSettings[iteration].tokenName : "";
                html.find("input[id='tokenName-" + iteration + "']")[0].disabled = false;
                html.find("input[id='sceneName-" + iteration + "']")[0].value = this.baseSettings[iteration].sceneName ? this.baseSettings[iteration].sceneName : "";
                html.find("input[id='sceneName-" + iteration + "']")[0].disabled = false;
            }
            this.updateSettings(this.baseSettings);
        });

        setIdBtn.on("click",(event)=>{
            const iteration = event.currentTarget.id.replace('setId-','');
            const baseId = html.find("input[id='MP_lastBaseAddress']")[0].value;
            if (baseId > 0) {
                html.find("input[id='baseId-" + iteration + "']")[0].value = baseId;
                html.find("input[id='baseId-" + iteration + "']")[0].style.color="green"
                this.baseSettings[iteration].baseId = baseId;
                this.updateSettings(this.baseSettings);
            }
        });

        setDataBtn.on("click",(event)=>{
            const iteration = event.currentTarget.id.replace('setData-','');
            const tokenName = html.find("input[id='MP_lastTokenName']")[0].value;
            const actorName = html.find("input[id='MP_lastTokenActorName']")[0].value;
            const sceneName = html.find("input[id='MP_lastTokenSceneName']")[0].value;
            if (tokenName != "") {
                html.find("input[id='tokenName-" + iteration + "']")[0].value = tokenName;
                html.find("input[id='sceneName-" + iteration + "']")[0].value = sceneName;
                html.find("input[id='actorName-" + iteration + "']")[0].value = actorName;

                this.baseSettings[iteration].tokenName = tokenName;
                this.baseSettings[iteration].sceneName = sceneName;
                this.baseSettings[iteration].actorName = actorName;
                this.updateSettings(this.baseSettings);
            }
        });

        deleteBtn.on("click",(event)=>{
            const id = event.currentTarget.id.replace('delete-','');
            let array = this.baseSettings.splice(id,1);
            this.baseSettings.bases = array;
            this.updateSettings(this.baseSettings, true);
        });

        addBtn.on("click",(event)=>{
            this.baseSettings.push({
                baseId:undefined,
                tokenName:undefined,
                actorName:undefined,
                linkActor:false
            })
            this.updateSettings(this.baseSettings, true);
        });
    }

    updateSettings(settings,render=false) {
        if (render) {
            this.update = true;
            this.render(true);
        }
        game.settings.set(MODULE.moduleName,'baseSetup',settings);
    }
  
  }