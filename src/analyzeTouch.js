import { moduleName } from "../MaterialPlane.js";
import { IRtokens } from "./analyzeIR.js";
import { debug } from "./Misc/misc.js";

let timeout = [];
let tokenActive = [];
let tapTimeout = [];
let raiseData = [];
let touches = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
let navTouchIds = [];
let touchStartCoord = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
let touchCoord = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
let pauseTimeoutCheck = false;
let lastMiddlePoint = -1;
let zoomHistory = [];
let startZoom = -1;

export async function analyzeTouch(type,data) {
    //console.log('data',type,data)
    //debug('touchDetect',{type,data});

    if (game.paused) {
        if (!pauseTimeoutCheck) {
            ui.notifications.warn("Material Plane: "+game.i18n.localize("GAME.PausedWarning"));
            pauseTimeoutCheck = true;
            setTimeout(function(){pauseTimeoutCheck = false},1000)
        }
        return;
    }

    const changedTouches = data.changedTouches;
    
    for (let touch of changedTouches) {
        let id = touches.findIndex(t => t == touch.identifier);
        if (id == -1) {
            id = touches.findIndex(t => t == -1);
            touches[id] = touch.identifier;
        }

        if (type == 'end') {
            touches[id] = -1;
            touchStartCoord[id] = -1;
            touchCoord[id] = -1;
            lastMiddlePoint = -1;
        }

        const coordinates = {x: touch.screenX, y: touch.screenY};
        const scaledCoordinates = scaleTouchInput(coordinates);
        debug('touchDetect', `${type}, id: ${id}, Coordinates: (${coordinates.x}, ${coordinates.y}), Scaled: (${scaledCoordinates.x}, ${scaledCoordinates.y})`);
        const forceNew = type == 'start';
        const tapMode = game.settings.get('MaterialPlane','tapMode');
        const zoomFactor = game.settings.get('MaterialPlane','zoomFactor')*0.1;
        const touchNavigation = game.settings.get('MaterialPlane','touchNavigation');


        if (tapMode == 'disable') {             //Tap disabled
            if (type == 'end')
                dropToken(id);
            else {
                if (type == 'start') tokenActive[id] = true;
                else if (!tokenActive[id]) return;
                if (timeout[id] != undefined) clearTimeout(timeout[id]);
                timeout[id] = setTimeout(touchTimeout,game.settings.get('MaterialPlane','touchTimeout'),id);
                await moveToken(id,coordinates,scaledCoordinates,forceNew);
            }    
        }
        else if (tapMode == 'tapTimeout') 
        {        //Tap Timeout
            if (type == 'end') {
                touchStartCoord[id] = -1;
                touchCoord[id] = -1;
                lastMiddlePoint = -1;
                zoomHistory = [];
                navTouchIds = navTouchIds.filter(function(item){return item !== id});
                clearTimeout(tapTimeout[id]);
                if (!tokenActive[id]) 
                    genericTouch(type,coordinates,scaledCoordinates);
                else{
                    tokenActive[id] = false;
                    dropToken(id);
                }
            }
            else if (type == 'start')
            {    
                tapTimeout[id] = setTimeout(tapDetect,game.settings.get('MaterialPlane','tapTimeout'),{id,coordinates,scaledCoordinates,forceNew}); 
                touchStartCoord[id] = coordinates;
                if(id === 2){
                    console.log("TEST"); 
                 }
                 else
                     startZoom = canvas.stage.scale._y;
            }
            else if (tokenActive[id]) {
                touchCoord[id] = coordinates;
                if(touchNavigation){
                    
 
                    if(!await navigation(id,coordinates,scaledCoordinates,forceNew,zoomFactor))
                    {
                        if(await moveToken(id,coordinates,scaledCoordinates,forceNew))
                        {
                            navTouchIds = navTouchIds.filter(function(item){return item !== id});
                        }
                    }
                }
                else{
                    await moveToken(id,coordinates,scaledCoordinates,forceNew);
                }
                
            }

        }
        else if (tapMode == 'raiseMini') {        //Raise Mini
            if (type == 'end') {
                touchStartCoord[id] = -1;
                touchCoord[id] = -1;
                lastMiddlePoint = -1;
                zoomHistory = [];
                navTouchIds = navTouchIds.filter(function(item){return item !== id});
                clearTimeout(tapTimeout[id]);
                if (!tokenActive[id]) 
                    genericTouch(type,coordinates,scaledCoordinates);
                else{
                    tokenActive[id] = false;
                    dropToken(id);
                }
            }
            else if (type == 'start')
            {    
                tapTimeout[id] = setTimeout(tapDetect,game.settings.get('MaterialPlane','tapTimeout'),{id,coordinates,scaledCoordinates,forceNew}); 
                timeout[id] = setTimeout(touchTimeout,game.settings.get('MaterialPlane','touchTimeout'),id);
                console.log("TEST"); 
                touchStartCoord[id] = coordinates;
                if(id !== 2)
                {    
                    startZoom = canvas.stage.scale._y;
                }
            }
            else if (tokenActive[id]) {
                touchCoord[id] = coordinates;
                if(touchNavigation){
                    
 
                    if(!await navigation(id,coordinates,scaledCoordinates,forceNew,zoomFactor))
                    {
                        if(await moveToken(id,coordinates,scaledCoordinates,forceNew))
                        {
                            navTouchIds = navTouchIds.filter(function(item){return item !== id});
                        }
                    }
                }
                else{
                    await moveToken(id,coordinates,scaledCoordinates,forceNew);
                }
                 if (timeout[id] != undefined) 
                     clearTimeout(timeout[id]);

                timeout[id] = setTimeout(touchTimeout,game.settings.get('MaterialPlane','touchTimeout'),id);
                
            }

            
        }
    }
}




async function tapDetect(data) {
    debug('tapDetect','Tap Timeout passed, allowing token movement')
    tokenActive[data.id] = true; 
    await moveToken(data.id,data.coordinates,data.scaledCoordinates,data.forceNew);
}

async function moveToken(id,coordinates,scaledCoordinates,forceNew) {
    return await IRtokens[id].update(coordinates,scaledCoordinates,forceNew);
}


async function navigation(id,coordinates,scaledCoordinates,forceNew,zoomFactor) {
    if(!navTouchIds.includes(id))
        navTouchIds.push(id);


    // Zooming
    if(navTouchIds.length == 2)
    {
        let startMiddlePoint = {x:touchStartCoord[navTouchIds[0]].x + touchStartCoord[navTouchIds[1]].x / 2,
         y:touchStartCoord[navTouchIds[0]].y + touchStartCoord[navTouchIds[1]].y / 2};

         let currentMiddlePoint = {x:touchCoord[navTouchIds[0]].x + touchCoord[navTouchIds[1]].x / 2,
         y:touchCoord[navTouchIds[0]].y + touchCoord[navTouchIds[1]].y / 2};


        let distanceStart = (calculateDistance(touchStartCoord[navTouchIds[0]].x, touchStartCoord[navTouchIds[0]].y,
            touchStartCoord[navTouchIds[1]].x , touchStartCoord[navTouchIds[1]].y)/100);
        let distance = (calculateDistance(touchCoord[navTouchIds[0]].x, touchCoord[navTouchIds[0]].y,
            touchCoord[navTouchIds[1]].x,touchCoord[navTouchIds[1]].y)/100);
        
        if(zoomHistory.length > 20) zoomHistory.shift();
        
        zoomHistory.push(distance);
        
        distance = 0;
        for (const dist of zoomHistory) {
            distance += dist;
        }
        
        distance = distance / zoomHistory.length;

        var difference = distance - distanceStart;
        var zoom = 0;
        if(Math.abs(difference) <1){
            var a = 1;
            if(distance -distanceStart < 0)
                a = -1;
            zoom = startZoom + a * Math.pow(Math.abs(difference),2)* zoomFactor;
        }
        else
            zoom = startZoom + difference* zoomFactor;
        
        if(zoom > 3)
            zoom = 3;
        else if(zoom < .1)
            zoom = .1;

        var zoomLevel =canvas.stage.scale._x;
        zoomLevel = (1-zoomLevel /3)

        if(zoomLevel < .1)
            zoomLevel = .15;

        if(lastMiddlePoint === -1){
            lastMiddlePoint = startMiddlePoint;
        }

        var panX = canvas.stage.pivot._x + (lastMiddlePoint.x - currentMiddlePoint.x) *zoomLevel;
        var panY = canvas.stage.pivot._y + (lastMiddlePoint.y - currentMiddlePoint.y) *zoomLevel;
        
        canvas.pan({x : panX, y : panY, scale : zoom});
        lastMiddlePoint = {x:currentMiddlePoint.x,y:currentMiddlePoint.y};
        return true;
    }
    return false;
}

function touchTimeout(id) {
    debug('dropToken','Touch timeout passed, dropping token');
    dropToken(id);
}

function dropToken(id=0) {
    clearTimeout(timeout[id]);
    timeout[id] = undefined;
    IRtokens[id].dropIRtoken();
    tokenActive[id] = false;
}

function scaleTouchInput(coords) {
    //Calculate the amount of pixels that are visible on the screen
    const horVisible = game.settings.get(moduleName, 'touchScaleX')*screen.width/canvas.scene._viewPosition.scale;
    const vertVisible = game.settings.get(moduleName, 'touchScaleY')*screen.height/canvas.scene._viewPosition.scale;

    //Calculate the scaled coordinates
    const posX = (coords.x/screen.width)*horVisible+canvas.scene._viewPosition.x-horVisible/2;
    const posY = (coords.y/screen.height)*vertVisible+canvas.scene._viewPosition.y-vertVisible/2;

    //Return the value
    return {x:Math.round(posX),y:Math.round(posY)};
}

function genericTouch(type,coordinates,scaledCoordinates) {
    let element = document.elementFromPoint(coordinates.x,coordinates.y);
    if (element == null) {
        if (type == 'end') 
        checkDoorClick(scaledCoordinates);
    }
    else if (element?.id == 'board') {
        if (type == 'end') {
            checkDoorClick(scaledCoordinates);
        }
        else {
            canvas.tokens.releaseAll();
            debug('tapDetect', `Tapped on canvas, releasing all tokens`)
        }
    }
}

function calculateDistance(x1, y1, x2, y2) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
  
    // Use the Pythagorean theorem to calculate the distance
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
    return distance;
  }

function checkDoorClick(data) {
    const doors = canvas.walls.doors;

    for (let door of doors) {
        if(door.doorControl === undefined){
            continue;
        }

        const position = door.doorControl.position;
        const hitArea = door.doorControl.hitArea;
        const widthDifference = Math.abs(data.x - position.x - hitArea.width/2)
        const heightDifference = Math.abs(data.y - position.y - hitArea.height/2)

        if (widthDifference <= hitArea.width &&  heightDifference <= hitArea.height) {
            const event = {
                data: {
                    originalEvent: {
                        button: 0
                    }
                },
                stopPropagation: event => {return;}
            }
            debug('tapDetect', `Door tapped`)
            door.doorControl._onMouseDown(event);
        }
    }
}
