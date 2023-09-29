import { moduleName } from "../../MaterialPlane.js";
import { cursor, findToken, scaleIRinput, MovingAverage } from "../Misc/misc.js";
import { IRtoken } from "../IRtoken/IRtoken.js";
import { penMenu } from "./penMenu.js";

/*
 * 
 */
export class Pen extends CanvasLayer {
    constructor() {
      super();
      this.cursor;
      this.menu;
      this.init();
    }

    selectedToken;
    irToken;
    oldCommand = 0;
    rulerActive = false;
    rulerOrigin = {
        x: 0,
        y: 0
    }
    ruler;
    template;
    newTemplate = false;
    templateData;
    drawing;
    lastDrawing;
    newDrawing = false;
    drawingData;
    holdTime;
    bar = {
        x0:undefined,
        x1:undefined,
        y0:undefined,
        y2:undefined,
        length:undefined,
        angle:undefined
    }
    cursorTimeout;
    open = false;
    visible = false;
    canvasPosition;
    canvasMoveOrigin = {x:0,y:0}
    canvasAverage = {
        x: new MovingAverage(10),
        y: new MovingAverage(10),
        scale: new MovingAverage(10)
    }
    drawingRotation;
  
    init() {
        this.cursor = new cursor();
        canvas.stage.addChild(this.cursor);
        this.cursor.init();
        
        this.menu = new penMenu();
        canvas.stage.addChild(this.menu);
        this.menu.init(this);
        this.menu.container.visible = false;

        this.irToken = new IRtoken;
    }

    setCursorTimeout(){
        if (this.cursorTimeout != undefined) 
            clearTimeout(this.cursorTimeout);
        this.cursor.show();
        let parent = this;
        this.cursorTimeout = setTimeout(function(){
            if (parent.cursor.visible) parent.cursor.hide();
            if (parent.menu.visible) parent.menu.hide();
            parent.cursorTimeout = undefined;
        },1000);
        
    }
  
    async draw() {
      super.draw();
    }

    async analyze(data){
        //console.log('penData',data)
        if (this.menu.open) this.menu.show();
        let command = data.command;
        if (command == 2) command = 'penIdle';
        else if (command == 3) command = 'penA';
        else if (command == 6) command = 'penD';
        else if (command == 4) command = 'penB';
        else if (command == 5) command = 'penC';
        else if (command == 7) command = 'penFront';
        else if (command == 8) command = 'penRear';
        
        //console.log('command',command)

        const point = data.irPoints[0];
        const coords = {x:point.x, y:point.y};
        let scaledCoords = scaleIRinput(coords);
        let status = 'click';

        if (command == 'penIdle') {         //no buttons pressed
            this.menu.drag = false;
            if (coords.x != undefined && coords.y != undefined) {
                this.updateCursor({
                    x: scaledCoords.x,
                    y: scaledCoords.y,
                    size: 5,
                    color: "0x00FF00",
                    rawCoords: coords
                });

                if (this.oldCommand != 'penIdle')   {
                    status = 'release';
                    this.holdTime = undefined;
                }
                else if (this.drawing != undefined && this.drawing.type && this.newDrawing) {
                    const event = {
                        data: {
                            destination: {
                                x: scaledCoords.x, 
                                y: scaledCoords.y
                            },
                            originalEvent: {
                                shiftKey: false,
                                altKey: false
                            }
                        }
                    }
                    this.drawing._onMouseDraw(event);
                    return;
                }
                else                                
                    return;
            }
        }
        
        status = (status != 'release' && this.oldCommand == command) ? 'hold' : status;

        let coordinates = {
            x: scaledCoords.x,
            y: scaledCoords.y,
            rawCoords: coords,
            x2: undefined,
            y2: undefined,
            length: undefined,
            angle: undefined
        };

        if (status == 'hold') {
            if (this.holdTime == undefined) this.holdTime = Date.now();

            if (command == 'penC' && this.menu.drag) {
                this.menu.moveMenu(coordinates);
                return;
            }
        }
        else {
            this.cursor.updateCursor({
                x: coordinates.x,
                y: coordinates.y,
                size: 5,
                color: "0xFFFFFF"
            })
            this.setCursorTimeout();

            if ((command == 'penC' || command == 'penD') && this.menu.location.x != undefined && this.menu.inMenu(coordinates)) {
                this.menu.getPoint(coordinates);
                return;
            }
        }

        if (status == 'release') {
            command = this.oldCommand;
            this.oldCommand = 'penIdle';
        }
        else
            this.oldCommand = command;

        if (command == 'penC' && status == 'click') { //draw or hide menu
            if (this.menu.visible) this.menu.hide();
            else this.drawMenu(coordinates);
            return;
        }
        else if (command == 'penB') {
            const point2 = data.irPoints[1];
            if (status == 'release' && (point2 == undefined || point2.x == undefined)) {
                coordinates.x2 = this.bar.x1;
                coordinates.y2 = this.bar.x1;
                coordinates.length = this.bar.length;
                coordinates.angle = this.bar.angle;
            }
            else if (point2 == undefined || point2.x == undefined) return;
            else {
                const coords2 = {x:point2.x, y:point2.y};
                const scaledCoords2 = scaleIRinput(coords2);
                const dx = scaledCoords2.x - scaledCoords.x;
                const dy = scaledCoords2.y - scaledCoords.y;
                const length = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy,dx)*180/Math.PI;
                coordinates.x2 = scaledCoords2.x;
                coordinates.y2 = scaledCoords2.y;
                coordinates.length = length;
                coordinates.angle = angle;
            }
            
        }

        if (this.menu.selectedName == "pointer")        this.pointerFunction(command,coordinates,status);
        else if (this.menu.selectedName == "token")     this.tokenFunction(command,coordinates,status);
        else if (this.menu.selectedName == "ruler")     this.rulerFunction(command,coordinates,status);
        else if (this.menu.selectedName == "target")    this.targetFunction(command,coordinates,status); 
        else if (this.menu.selectedName == "draw")      this.drawFunction(command,coordinates,status);  
        else if (this.menu.selectedName == "template")  this.templateFunction(command,coordinates,status);  
    }

    pointerFunction(command,data,status) {
        if (command == 'penD' && status == 'click') {
            const x = data.rawCoords.x / 4096 * window.innerWidth;
            const y = data.rawCoords.y / 4096 * window.innerHeight;

            let element = document.elementFromPoint(x,y)
            if (element != null && element.id != 'board') {
                element.click();
            }
            else {
                this.checkDoorClick(data);
            }
        }
        else if (command == 'penA' && status == 'click') {
            this.canvasPosition = JSON.parse(JSON.stringify(canvas.scene._viewPosition));
            this.canvasMoveOrigin = {x:data.x, y:data.y};
            this.canvasAverage.x.reset();
            this.canvasAverage.y.reset();
        }
        else if (command == 'penB' && status == 'click') {
            this.canvasPosition = JSON.parse(JSON.stringify(canvas.scene._viewPosition));
            this.canvasAverage.scale.reset();

            this.bar = {
                x0:data.x,
                x1:data.x2,
                y0:data.y,
                y2:data.y2,
                length:data.length,
                angle:data.angle,
                rawCoords: data.rawCoords
            }
        }
        else if (command == 'penA' && status == 'hold') {
            const x = this.canvasAverage.x.newValue(data.x);
            const y = this.canvasAverage.y.newValue(data.y);
            
            const moved = {
                x: this.canvasMoveOrigin.x - x,
                y: this.canvasMoveOrigin.y - y
            }

            canvas.animatePan({x: this.canvasPosition.x + moved.x, y: this.canvasPosition.y + moved.y, duration: 50})
        }
        else if (command == 'penB' && status == 'hold') {
            const angle = this.canvasAverage.scale.newValue(this.bar.angle-data.angle);
            canvas.animatePan({scale: this.canvasPosition.scale + angle*0.02, duration:50});
        }
    }

    tokenFunction(command,data,status) {
        if (command == 'penD'){
            if (status == 'click') {
                this.checkTokenClick(data);
            }
            else if (status == 'hold') {
                this.irToken.update(data.rawCoords,{x:data.x, y:data.y},false)
            }  
            else if (status == 'release') {
                this.irToken.update(data.rawCoords,{x:data.x, y:data.y},false)
                this.irToken.dropIRtoken();
            }
        }
        else if (command == 'penA'){
            if (status == 'click') {
                this.checkTokenClick(data,true);
            }
        }
        else if (command == 'penB') {
            if (status == 'click') {
                this.checkTokenClick(data);
                this.bar = {
                    x0:data.x,
                    x1:data.x2,
                    y0:data.y,
                    y2:data.y2,
                    length:data.length,
                    angle:data.angle,
                    rawCoords: data.rawCoords
                }
            }
            else if (status == 'hold') {
                const angleChange = data.angle - this.bar.angle;
                if (command == 'penB') {
                    this.bar = {
                        x0:data.x,
                        x1:data.x2,
                        y0:data.y,
                        y2:data.y2,
                        length:data.length,
                        angle:data.angle
                    }
                } else {
                    this.bar.angle = data.angle;
                }
                
                let forceNew = false;
                if (command == 'penB') this.irToken.update(data.rawCoords,{x:data.x, y:data.y},forceNew);
                else this.irToken.update(this.bar.rawCoords,{x:this.bar.x0, y:this.bar.y0},forceNew,false);
                this.irToken.token.document.rotation += angleChange;
                this.irToken.token.refresh();
                if (game.settings.get(moduleName,'movementMethod') == 'live') this.irToken.token.updateSource({noUpdateFog: false});
            }
            else if (status == 'release') {
                this.irToken.dropIRtoken(false);
            }  
        }
    }

    rulerFunction(command,data,status) {
        if (command == 'penD') {
            if (status == 'click') {
                if (this.rulerActive && this.ruler != undefined) {
                    this.ruler._addWaypoint({x:data.x, y:data.y});
                    this.rulerOrigin = {x:data.x, y:data.y};
                }
                else {
                    this.rulerActive = true;
                    if (this.ruler != undefined) this.ruler.clear();
                    this.ruler = new Ruler(game.user);
                    canvas.controls._rulers[game.user.id] = canvas.controls.rulers.addChild(this.ruler);
    
                    const event = {
                        data: {
                            origin: {x:data.x, y:data.y},
                            destination: {x:data.x, y:data.y},
                            originalEvent: {
                                shiftKey: false
                            },
                        },
                        _measureTime: Date.now()
                    }
                    this.ruler._onDragStart(event);
                }
            } 
        }
        else if (command == 'penA') {
            if (status == 'click') {
                if (this.rulerActive) {
                    const event = {
                        interactionData: {
                            origin: this.rulerOrigin,
                            destination: {x:data.x, y:data.y},
                            _measureTime: Date.now(),
                            originalEvent: {
                                shiftKey: false
                            },
                        },
                    }
                    this.ruler._onClickRight(event);
                }
                else {
                    this.ruler.clear();
                    this.ruler = undefined;
                    this.rulerActive = false;
                }
            }
            else if (status == 'hold' && this.rulerActive && Date.now() - this.holdTime >= 500) {
                this.rulerActive = false;
            }
        }
        else if (command == 'penB') {
            if (status == 'click' || status == 'release') {
                this.ruler.clear();
                this.ruler = undefined;
                this.rulerActive = false;
            }
        }
    }

    targetFunction(command,data,status) {
        if (command == 'penD' && status == 'click') {
            const token = findToken(data);
            if (token == undefined) return;
            token.setTarget(!token.isTargeted,{releaseOthers:false});
        }
    }

    async drawFunction(command,data,status) {
        
        if (command == 'penD') {
            if (status == 'click') {
                if (this.menu.selectedDrawingTool == 1) {
                    this.drawing = this.getNearestDrawing(data);
                    this.lastDrawing = this.drawing;
                }
                else if (this.menu.selectedDrawingTool == 6) {
                    this.drawing = this.getNearestDrawing(data);
                    if (this.drawing != undefined) {
                        this.drawing.document.delete();
                        this.drawing = undefined;
                        this.lastDrawing = undefined;
                    }
                }
                else if (this.drawing != undefined && this.drawing.type == CONST.DRAWING_TYPES.POLYGON && this.drawing.document.bezierFactor == 0 && this.newDrawing) {
                    this.drawing._addPoint({x:data.x,y:data.y},false)
                }
                else {
                    let tool = this.menu.selectedDrawingToolName;
                    let drawingData = canvas.layers.filter(layer => layer.name == 'DrawingsLayer')[0]._getNewDrawingData({x:data.x,y:data.y})
                    let type;
                    if (tool == 'rect') type = CONST.DRAWING_TYPES.RECTANGLE;
                    else if (tool == 'ellipse') type = CONST.DRAWING_TYPES.ELLIPSE;
                    else if (tool == 'polygon') type = CONST.DRAWING_TYPES.POLYGON;
                    else if (tool == 'freehand') {
                        type = CONST.DRAWING_TYPES.POLYGON;
                        ui.controls.controls.find(c => c.name == 'drawings').activeTool = 'freehand';
                        ui.controls.render(); 
                    }

                    drawingData.shape.type = type;
                    if (tool == 'freehand') drawingData.bezierFactor = 0.5;
                    drawingData.fillColor = this.menu.colors[this.menu.selectedFillColor].hex;
                    drawingData.fillType = this.menu.colors[this.menu.selectedFillColor].name == 'none' ? 0 : 1;
                    drawingData.strokeColor = this.menu.colors[this.menu.selectedLineColor].hex;
                    drawingData.strokeAlpha = this.menu.colors[this.menu.selectedLineColor].name == 'none' ? 0 : 1;
                    drawingData.x = data.x;
                    drawingData.y = data.y;
                    drawingData.strokeAlpha = 1;
                    drawingData.strokeWidth = 8;

                    const document = new DrawingDocument(drawingData, {parent: canvas.scene});
                    this.drawing = new Drawing(document);
                    canvas.drawings.preview.addChild(this.drawing);
                    this.drawing._addPoint({x:data.x, y:data.y},false)
                    this.drawing.draw();
                    
                    this.newDrawing = true;
                }
            }
            else if (status == 'hold') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;

                if ((this.drawing.type == CONST.DRAWING_TYPES.POLYGON || this.drawing.type == CONST.DRAWING_TYPES.FREEHAND) && this.newDrawing) {
                    const event = {
                        data: {
                            destination: {
                                x:data.x, 
                                y:data.y
                            },
                            originalEvent: {
                                shiftKey: false,
                                altKey: false
                            }
                        }
                    }
                    this.drawing._onMouseDraw(event);
                }
                else {
                    const dx = data.x - this.drawing.x;
                    const dy = data.y - this.drawing.y;

                    this.drawing.document.shape.width = dx;
                    this.drawing.document.shape.height = dy;
                    this.drawing.refresh();
                }
                
            }
            else if (status == 'release') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;
                
                if (this.drawing.type != CONST.DRAWING_TYPES.POLYGON || this.drawing.document.bezierFactor > 0) {
                    if (this.newDrawing) {
                        this.newDrawing = false;
                        canvas.drawings.preview.removeChild(this.drawing);
                        const cls = getDocumentClass('Drawing');
                        this.lastDrawing = await cls.create(this.drawing.document.toObject(false), {parent: canvas.scene});
                        this.drawing.destroy();
                        this.drawing == undefined;
                    }
                    else {   
                        this.drawing.document.update({width:this.drawing.shape.width, height:this.drawing.shape.height});
                        this.lastDrawing = this.drawing;
                        this.drawing.refresh();
                        this.drawing == undefined;
                    }
                }
            }   
        }
        else if (command == 'penA') {
            if (status == 'click') {
                if (this.newDrawing && this.drawing.type == CONST.DRAWING_TYPES.POLYGON) {
                    this.newDrawing = false;
                    canvas.drawings.preview.removeChild(this.drawing);
                    const cls = getDocumentClass('Drawing');
                    this.lastDrawing = await cls.create(this.drawing.document.toObject(false), {parent: canvas.scene});
                    this.drawing == undefined;
                }
                else {
                    this.drawing = this.getNearestDrawing(data);
                    this.lastDrawing = this.drawing;
                }
            }
            else if (status == 'hold') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;
                this.drawing.document.x = data.x - this.drawing.shape.width/2;
                this.drawing.document.y = data.y - this.drawing.shape.height/2;
                this.drawing.refresh();
            }
            else if (status == 'release') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;
                this.drawing.document.update({x:this.drawing.x, y:this.drawing.y});
            }
        }
        else if (command == 'penB') {
            if (status == 'click') {
                this.drawing = this.getNearestDrawing(data);
                this.lastDrawing = this.drawing;
                this.drawingRotation = JSON.parse(JSON.stringify(this.drawing.shape.rotation));
                this.bar = {
                    x0:data.x,
                    x1:data.x2,
                    y0:data.y,
                    y2:data.y2,
                    length:data.length,
                    angle:data.angle
                }
            }
            else if (status == 'hold') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;
                const angleChange = data.angle - this.bar.angle;
                this.drawing.document.x = data.x - this.drawing.shape.width/2;
                this.drawing.document.y = data.y - this.drawing.shape.height/2;

                if (!isNaN(angleChange)) {
                    this.drawing.document.rotation = this.drawingRotation + angleChange;
                }
                this.drawing.refresh();
                
            }
            else if (status == 'release') {
                if (this.drawing == undefined || this.menu.selectedDrawing == 6) return;
                this.drawing.document.update({x:this.drawing.document.x, y:this.drawing.document.y, rotation:this.drawing.document.rotation})
            }  
        }
    }

    templateFunction(command,data,status) {
        if (command == 'penD') {
            if (status == 'click') {
                if (this.menu.selectedTemplate == 1) {
                    this.template = this.getNearestTemplate(data);
                }
                else if (this.menu.selectedTemplate == 6) {
                    this.template = this.getNearestTemplate(data);
                    if (this.template != undefined) {
                        this.template.document.delete();
                        this.template = undefined;
                    }
                }
    
                else {
                    let tool = this.menu.selectedTemplateName;
    
                    const snappedPosition = canvas.grid.getSnappedPosition(data.x, data.y, canvas.templates.gridPrecision);
    
                    const templateData = {
                        user: game.user.id,
                        t: tool,
                        x: snappedPosition.x,
                        y: snappedPosition.y,
                        distance: 1,
                        direction: 0,
                        fillColor: game.user.color || "#FF0000"
                    };
    
                    // Apply some type-specific defaults
                    const defaults = CONFIG.MeasuredTemplate.defaults;
                    if ( tool === "cone") templateData["angle"] = defaults.angle;
                    else if ( tool === "ray" ) templateData["width"] = (defaults.width * canvas.dimensions.distance);
    
                    const doc = new MeasuredTemplateDocument(templateData, {parent: canvas.scene});
    
                    this.template = new MeasuredTemplate(doc);
                    
                    canvas.templates.preview.addChild(this.template);
                    this.template.draw();
    
                    this.newTemplate = true;
                }
            }
            else if (status == 'hold') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                const dx = data.x - this.template.x;
                const dy = data.y - this.template.y;
                const length = Math.round(Math.sqrt(dx*dx + dy*dy)*canvas.dimensions.distance/canvas.dimensions.size);
                const angle = 90-Math.atan2(dx,dy)*180/Math.PI;
                this.template.document.distance = length;
                this.template.document.direction = angle;
                this.template.refresh();
                //this.template.highlightGrid();
            }
            else if (status == 'release') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                if (this.newTemplate) {
                    this.menu.setSelected(1,true)
                    this.newTemplate = false;
                    this.template.controlIcon.visible = false;
                    canvas.templates.preview.removeChild(this.template);
                    const cls = getDocumentClass('MeasuredTemplate');
                    return cls.create(this.template.document.toObject(false), {parent: canvas.scene});
                }
                else {
                    this.template.document.update({distance:this.template.document.distance,direction:this.template.document.direction});
                }  
                    
            }   
        }
        else if (command == 'penA') {
            if (status == 'click')
                this.template = this.getNearestTemplate(data);
            else if (status == 'hold') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                this.template.document.x = data.x;
                this.template.document.y = data.y;

                //this.template.refresh();
                this.template.renderFlags.set({refreshPosition:true, refreshGrid:true})
                //this.template.highlightGrid();
            }
            else if (status == 'release') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                const snappedPosition = canvas.grid.getSnappedPosition(data.x, data.y, canvas.templates.gridPrecision);
                this.template.document.update({x:snappedPosition.x,y:snappedPosition.y});
            }
        }
        else if (command == 'penB') {
            if (status == 'click') {
                this.template = this.getNearestTemplate(data);
                this.bar = {
                    x0:data.x,
                    x1:data.x2,
                    y0:data.y,
                    y2:data.y2,
                    length:data.length,
                    angle:data.angle
                }
            }
            else if (status == 'hold') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                const angleChange = data.angle - this.bar.angle;
                this.bar = {
                    x0:data.x,
                    x1:data.x2,
                    y0:data.y,
                    y2:data.y2,
                    length:data.length,
                    angle:data.angle
                }
                
                if (!isNaN(angleChange)) this.template.document.direction += angleChange;
                this.template.document.x = data.x;
                this.template.document.y = data.y;
                
                this.template.refresh();
                this.template.highlightGrid();
            }
            else if (status == 'release') {
                if (this.template == undefined || this.menu.selectedTemplate == 6) return;
                const snappedPosition = canvas.grid.getSnappedPosition(data.x, data.y, canvas.templates.gridPrecision);
                this.template.document.update({x:snappedPosition.x,y:snappedPosition.y,direction:this.template.document.direction});
            }  
        }
    }

  
    /*
     * Update the cursor position, size and color
     */
    updateCursor(data) {
        let cursorData = {
            x: data.x,
            y: data.y,
            size: 5,
            color: "0x00FF00",
            selected: this.menu.selected,
            selectedTemplate: this.menu.selectedTemplate,
            selectedDrawintTool: this.selectedDrawingTool
        }
        if (this.menu.selected == 5)
            cursorData.icon = this.menu.drawingOptions[this.menu.selectedDrawingTool-1];
        else if (this.menu.selected == 6)
            cursorData.icon = this.menu.templateOptions[this.menu.selectedTemplate-1];
        else if (this.menu.selected > 0) 
            cursorData.icon = this.menu.options[this.menu.selected-1];
        
        this.cursor.updateCursor(cursorData);

        this.setCursorTimeout();
        
        if (this.menu.location.x != undefined) {
            if (this.menu.inMenu(data)) {
                this.menu.alpha = 0.85;
            }
            else {
                this.menu.alpha = 0.5;
                const destination = {x:data.x, y:data.y};
                if (this.rulerActive && this.ruler != undefined) {
                    const event = {
                        interactionData: {
                            origin: this.rulerOrigin,
                            destination,
                            _measureTime: Date.now()-100,
                            originalEvent: {
                                shiftKey: false
                            },
                        },
                        
                    }
                    this.ruler._onMouseMove(event);
                }
            }
        }
    }

    drawMenu(data) {
        this.cursor.hide();
        this.menu.drawMenu(data);
    }

    getNearestTemplate(data) {
        let templates = canvas.templates.placeables;
        let nearestTemplate = undefined;
        let nearestDistance = 10000;
        for (let template of templates) {
            const dist = Math.abs(template.x-data.x) + Math.abs(template.y-data.y)
            if (dist < canvas.dimensions.size*5 && dist < nearestDistance) {
                nearestTemplate = template;
                nearestDistance = dist;
            }
        }
        return nearestTemplate;
    }

    getNearestDrawing(data) {
        let drawings = canvas.drawings.placeables;
        let nearestDrawing = undefined;
        let nearestDistance = 10000;
        for (let drawing of drawings) {
            let dist;
            dist = Math.abs(drawing.x+drawing.document.shape.width/2-data.x) + Math.abs(drawing.y+drawing.document.shape.height/2-data.y);
            if (dist < canvas.dimensions.size*5 && dist < nearestDistance) {
                nearestDrawing = drawing;
                nearestDistance = dist;
            }
        }
        return nearestDrawing;
    }

    checkDoorClick(data) {
        const doors = canvas.walls.doors;
        for (let door of doors) {
            const position = door.doorControl.position;
            const hitArea = door.doorControl.hitArea;

            if (Math.abs(data.x - position.x - hitArea.width/2) <= hitArea.width/2 && Math.abs(data.y - position.y - hitArea.height/2) <= hitArea.height/2) {
                const event = {
                    button: 0,
                    stopPropagation: event => {return;}
                }
                door.doorControl._onMouseDown(event);
            }
        }
    }

    checkTokenClick(data, forceRelease=false) {
        const token = findToken(data);
        if (token == undefined) {
            for (let t of canvas.tokens.controlled)
                t.release();
        }
        else if (forceRelease) {
            token.release();
        }
        else {
            if (token._controlled) token.release();
            else {
                token.control({releaseOthers:false});
                this.selectedToken = token;
            }
        }
    }

    
    /*
     * Hide the cursor
     */
    hide() {
        
    }
  
    /*
     * Show the cursor
     */
    show() {
        this.container.visible = true;
    }

    hideMenu(){
        
    }

    showMenu() {
      
    }
  
    /*
     * Remove the cursor
     */
    remove() {
     
    }
}