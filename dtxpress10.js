"use strict";

// embellish Array
if (!Array.prototype.top) Array.prototype.top=function(){return( this[this.length-1])}
 
/* define the ScopeStack class */
function ScopeStack(binding, initFrames) {

    this.binding=binding;
    this.frames=[];
    for (var i=0; i<initFrames.length; i++) this.frames.push(initFrames[i]);
    this.length=this.frames.length;
    
}

ScopeStack.prototype.push=function(frame) {
    this.frames.push(frame);
    this.length=this.frames.length;
}

ScopeStack.prototype.pop=function() {
   var frame=this.frames.pop(frame);
   this.length=this.frames.length;
   return(frame);
}

ScopeStack.prototype.top=function() {
   return(this.frames[this.length-1]);
}

ScopeStack.prototype.setLength=function(l) {
   this.frames.length=l;
   this.length=l;
}

ScopeStack.prototype.getLength=function() {
   return this.frames.length;
}

ScopeStack.prototype.getFrame=function(id) {
   for (var i=this.frames.length-1;i>=0;i--) if (this.frames[i].id==id) return(this.frames[i].frame);
}

ScopeStack.prototype.resolveSymbol=function(symbol) {
    
	// is this a processing instruction {{}}
	if (Binding.isIterationInstruction(symbol) ) {
	    console.log("Binding.resolveSymbol() symbol "+symbol+" resolves to an IteratioController");
        return ( this.ceateIterationController(symbol))
	}
 
    var symVal=null;
    for (var i=this.frames.length-1; i>=0; i--) {
        if ( this.frames[i].frame.hasOwnProperty(symbol)){
            symVal=this.frames[i].frame[symbol];
			break;
        }
    }
	
	// look into the global scope
	if ( (symVal==null) && Binding.globals && Binding.globals[symbol] ) {
	    console.log("Binding.resolveSymbol("+symbol+") resolved in global (window) scope ");
		symVal=Binding.globals[symbol];
	}

	/* this should not be a default - push window onto the stack if you wish, but it will always be scoped above Binding.globals
	// finally, look into the window scope
	if ( (symVal==null) && window[symbol] ) {
	    console.log("Binding.resolveSymbol("+symbol+") resolved in global (window) scope ");
	}
	*/
	
	// if symVal is a function - execute the function and then process the result 
	if ( (symVal!=null) && (typeof symVal === "function")) {
		console.log("Binding.resolveSymbol() symbol "+symbol+" resolves to a function - executing function");
		symVal = symVal.apply(this.top().frame, [this.binding]);
	}  
	
	if (symVal!=null) {
		console.log("Binding.resolveSymbol("+symbol+")="+symVal);
		return(symVal);
	} else {
		console.log("Binding.resolveSymbol("+symbol+") not resolved");
	    return(undefined);
	}
}


ScopeStack.prototype.ceateIterationController=function(symbol) {
	// the text after the ":" is the symbol ID
	// text before the ":" is the id to use for the iteration instance
	var parsed= symbol.replace(/[\{\}]/g,"").split(":")
	return new IterationController(parsed[0], parsed[1],this.resolveSymbol(parsed[1]));
}

ScopeStack.prototype.linkFunction=function(symbol) {
 
    for (var i=this.frames.length-1; i>=0; i--) {
        if ( this.frames[i].frame.hasOwnProperty(symbol)){
            var symVal=this.frames[i].frame[symbol];
            
            // if it is a function - execute the function and then process the result 
            if (typeof symVal === "function") {
                return(symVal);
            }   
        }
    }
    // console.log("Binding.resolveSymbol("+symbol+") not resolved");
    return(undefined)
}
// the ScopeStacj is an array of StackFrames
function StackFrame(id,frame) {
    this.id=id;
    this.frame=frame;
}

// when an iterable is being iterated, one of thes is pushed before each iteration, and popped immediately after
function IterationState( context, index, symbolicId,nodeId ){
    this.context=context; // add the full repetition context - i.e. reference to the iterable object being elaborated
    this.$index=index; // the repetition index addressable form local scope only
    if (nodeId) this.nodeId=nodeId;
    this[symbolicId+"$index"]=index; // the repetition index addressable form later scopes - ie higher on the stack
    this[symbolicId+"$"+index]=context; // add a reference to the current item of the iterable - note the item itself is pushed in a subsequent frame
	this[symbolicId]=context;
} 
 
IterationState.prototype.getCurrentIterationItem=function() {
    return(this.context);
}
 
/*
the initial scope is an array (used as the stack) and  can be seeded with objects to provide 
data or functions to populate or control the template elaboration - functions are applied to the
scope object whenever invoked 
*/
function Binding ( scopeFrames, settings ) {    
    
    if (scopeFrames) this.scopeStack=this.createScopeStack(scopeFrames);
    else this.scopeStack= this.createScopeStack([new StackFrame("/",{})]);
    
    this.settings=Binding.clone(Binding.defaultSettings);
    if ( settings) for (var prop in Object.keys(settings)) this.settings[prop]=settings[prop];
}

Binding.APPEND=101;
Binding.REPLACE=102;
Binding.defaultSettings={   wrapping:['{{','}}'],  action:Binding.REPLACE};
Binding.TEXT_SPLITTER="¦";

Binding.prototype.createScopeStack=function( scopeFrames){
    return new ScopeStack(this, scopeFrames);
}

Binding.prototype.getFrame=function(frameId) {
    return(this.scopeStack.getFrame(frameId));
}
   
Binding.clone=function(o) {
    return(JSON.parse(JSON.stringify(o)))
}

Binding.applyAttributes=function(ele, attributes) {
    for (var attrName in attributes) if (attributes.hasOwnProperty(attrName)) ele.setAttribute(attrName, attributes[attrName]);
}

Binding.isIterable=function (obj) {
    try { 
        return obj.length > 0 && '0' in Object(obj);
    } catch(e) {
        return false;
    }
}

Binding.isIterationInstruction=function (str) {
    // PI has the form "{{xxxx:yyyy}}"
    return /{{[^:]+:[^:]+}}/.test(str);
}

// one helper function to insert the elaborated content after the template
Binding.insertAfterTemplate=function (ref,eArray){
    ref.rendered=eArray;
    var parent=ref.parentNode;
    
    for(var x=0;x<eArray.length;x++) {
        parent.insertBefore(eArray[x],ref.nextSibling);
        ref=eArray[x]
    }
}

// remove any output from a template
Binding.clearTemplate=function(template) {
    if (template.rendered) {
        for(var x=0;x<template.rendered.length;x++) {
            template.rendered[x].parentNode.removeChild(template.rendered[x]);
        }
    }
}     
            
Binding.prototype.unwrap=function(txt) {
    if (!txt) return(undefined);
    txt=txt.trim();
    if ( txt.startsWith(this.settings.wrapping[0]) && txt.endsWith(this.settings.wrapping[1])) {
        return( txt.substring(this.settings.wrapping[0].length, txt.length - this.settings.wrapping[1].length ));
    }
    return(undefined);
}


Binding.prototype.resolveSymbol=function(symbol) {
    return(this.scopeStack.resolveSymbol(symbol));
}

Binding.prototype.linkFunction=function(fName){
    return(this.scopeStack.linkFunction(fName));
}

// resolve symbols, but only allow text to be returned
Binding.prototype.resolveAttributeSymbols=function( txt) { 
    var splits=this.resolveEmbeddedSymbols(txt)
    // requires all string values at this point
    return( splits.join(""));
}

// resolve symbols,and return an array of elements - return an array of nodes - text or other
Binding.prototype.resolveEmbeddedSymbols=function( txt) { 
    // split the text  
    var output=[];
    var startRegExp=new RegExp(this.settings.wrapping[0], 'g');
    var endRegExp=new RegExp(this.settings.wrapping[1], 'g');
    var doubleRegExp=new RegExp(Binding.TEXT_SPLITTER+Binding.TEXT_SPLITTER, 'g');
    
    // prepare the string by inserting delimiters & removing doubles if the are inserted
    var delimited= txt.replace(startRegExp,Binding.TEXT_SPLITTER+this.settings.wrapping[0]).replace(endRegExp,this.settings.wrapping[1]+Binding.TEXT_SPLITTER).replace(doubleRegExp,Binding.TEXT_SPLITTER);
    var splits=delimited.split(Binding.TEXT_SPLITTER); 

    // examine each portion of text 
    for (var i=0; i<splits.length; i++) {
        var symbol=this.unwrap(splits[i]);
        // unwrap returns undefined if the text is not wrapped a symbolic reference
        if (symbol) {
            var symValue=this.resolveSymbol( symbol);
            if ( symValue instanceof Array) {
                for (var j=0; j<symValue.length; j++) output.push(symValue[j]); // push each element of the array
            } else if (symValue instanceof GroupWrapper) {
                for (var k=0; k<symValue.childNodes.length; k++) output.push(symValue.childNodes[k]); // push each child & ignore the wrapper 
            } else if (symValue!=undefined) {
                output.push(symValue); // push a single return value
            } else {
                output.push(splits[i]); // push the wrapped symbol as a string
            }
        } else  {
            output.push(splits[i]);// push the text - there is no wrapped symbol in it
        }
    }
    // requires all string values at this point
    return( output );
}

Binding.prototype.cloneAndBindElement=function(ele,  mappedAttrs) {
    // clone the element without children
    var newEle=ele.cloneNode(false);
    if(ele.id) {
	    newEle.id=Binding.createUniqueId(ele.id);
		Binding.setSymbol(newEle, ele.id, newEle.id);
	}
	 
    // apply attributes
    Binding.applyAttributes(newEle,mappedAttrs);
    
    // append any children 
    // var childNodes=this.elaborateFragment(ele,mappedAttrs);
    var childNodes=this.elaborateFragment(ele );
    if(childNodes) for (var i=0;i<childNodes.length;i++) newEle.appendChild(childNodes[i]);
    return(newEle);
}
 
Binding.prototype.cloneAndAppend=function(ele,mappedAttrs,simpleValue){
    var newEle=ele.cloneNode(false);
    
    // apply attributes to node
    Binding.applyAttributes(newEle,mappedAttrs);
    
    // append any children 
    //var childNodes=this.elaborateFragment(ele,mappedAttrs);
    var childNodes=this.elaborateFragment(ele );
    if(childNodes) for (var i=0;i<childNodes.length;i++) newEle.appendChild(childNodes[i]);
    
    // insert new text node as last child
    newEle.appendChild(document.createTextNode( simpleValue ))
    
    return(newEle);
}

Binding.prototype.mapAttributes=function(node) {
    var mappedAttrs= {};
    for (var j = 0, attrs = node.attributes, n = attrs.length ; j<n; j++){
        if (attrs[j].name!="id") {
            mappedAttrs[attrs[j].name]=this.resolveAttributeSymbols(attrs[j].value)||attrs[j].value;
        }
    }
    return(mappedAttrs);
}

Binding.idCounter=0;

Binding.prototype.elaborateNode=function( node ) {
    var nodesOut=[];
    var newNode, newChildren;
   
        if (node.nodeType==Node.ELEMENT_NODE){
        
            // map any wrapped attributes
            // improve to handle wrapped refrences embedded in 
            // var mappedAttrs= this.mapAttributes(node);
            
            // map by element id and optionally recurse
            if (node.id) {
			 
                // node id always resolved in the current scope - but other attributes resolved in any new scope if the id maps to an object or iterable
				var symValue =this.resolveSymbol( node.id);  // strict?
                
                // handle different scenarios depending on the type of the value found
                if ((symValue===null)) {
				    // this is an explicit instruction to drop this element from the output
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - do nothing: "+node.id+"="+symValue);
                    // do nothing
					// node has an id, but it dowsn't map to anything
					// the id needs to be augmented to prevent id collisions 
					// node.id=idStem+"$"+node.id +"$id_augmentation_1"
					
                }  else if ( symValue instanceof Node ) {
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - element id "+node.id+" resolves to DOM Element");
                    // replace the element node with this one
                    // children of the in-node are not processed - but this could be configurable by a setting
                    // apply attribute values
                    if (symValue.nodeType==Node.ELEMENT_NODE) {
                        Binding.applyAttributes(symValue,this.mapAttributes(node));
                        symValue.id=BInding.createUniqueId(node.id) ; //idStem+"/"+node.id;
						Binding.setSymbol(symValue,node.id,symValue.id);
                    }
                    nodesOut.push(symValue); 
					
                } else  if ( typeof symValue === "string" ) {
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - element id "+node.id+" resolves to a string"); 
                    nodesOut.push( this.cloneAndAppend(node, this.mapAttributes(node), symValue));
					
                } else  if ( typeof symValue === "number" ) {
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - element id "+node.id+" resolves to a number");
                    nodesOut.push( this.cloneAndAppend(node, this.mapAttributes(node), symValue));
					
                } else if ( typeof symValue === "boolean" ) {
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - element id "+node.id+" resolves to a boolean");
                    nodesOut.push( this.cloneAndAppend(node, this.mapAttributes(node), symValue));
					
                } else if ( symValue instanceof IterationController) {
				    console.log("Binding.elaborateNode()IterationController.length =  "+symValue.length);
                    // this iteration is processes in a controlled manner 
                    // iteration is controlled by the containing element, and only the child nodes of the container are iterated
                    // make a clone of the top level node 
                    var container=node.cloneNode(false);
					// clone the full tree of the node in the template
					//var repElement=node.cloneNode(true);
					container.id=Binding.createUniqueId(symValue.symbolId);//idStem+"$"+symValue.symbolId;		
					Binding.setSymbol(container,node.id,container.id);
					
					nodesOut.push(container);
					var itObj;
					while ( symValue.hasMore() ) { 
                        // the itObj needs to be placed on the scopeStack with the iterationId
					    itObj=symValue.next();
					    console.log("Binding.elaborateNode()IterationController.next() =  "+itObj);
						
                        // create a unique ID for the iteration
                        //var repId=Binding.createUniqueId(symValue.iterationId) ;//idStem +"$"+symValue.symbolId+"$" +symValue.index;
                        
						// set-up the scope
                        var scopeStackLength=this.scopeStack.length;
						//var iterationState=new IterationState( itObj, symValue.index,symValue.iterationId,repId); 
						var iterationState=new IterationState( itObj, symValue.index,symValue.iterationId,null); 
                        
						this.scopeStack.push( new StackFrame(node.id,iterationState) );

                        var newScopeObj={};
						newScopeObj[symValue.iterationId]=itObj;
                        
                        this.scopeStack.push( new StackFrame(symValue.symbolId+"$"+symValue.index,newScopeObj) );
						// push the iteration object also to allow immediate access to its properties
						this.scopeStack.push( new StackFrame(symValue.symbolId+"$"+symValue.index+"$"+symValue.iterationId,itObj) );
                        
                        // produce repContent - replicated content that has been merged with the data
                        // repContent will contain one node for each child of node
                        var repContent=this.elaborateFragment(node );
                        repContent.forEach( function(e) { if (e.nodeType==Node.ELEMENT_NODE) e.modelObj=itObj;});
                      
                        // dom should link back to only one view element
                        // be aware of GroupWrapper objects here it may not have a ..classList or ..classList.contains
                        repContent.forEach( function(e) { if (e.classList && e.classList.contains("dt-attach-model")) if(!itObj.dt$dom) {itObj.dt$dom=[]; itObj.dt$dom.push(e)}});
                        	
                        // pop the  stack - restore to scopeStackLength
                        this.scopeStack.setLength(scopeStackLength);
                        
                        // add the produced content to the accumulted update
						repContent.forEach( function(e) {container.appendChild(e) });
                        
                        //nodesOut=nodesOut.concat(repContent);
				    } // end of while
					//nodesOut.push(container);
				} else if ( Binding.isIterable(symValue)) {
					// console.log("Binding.elaborateNode("+node.id+") iterable length =  "+symValue.length); 
					// add the iteration context item to the iteration state frame and push/pop an iteration state for each 
					// iteration of the array (list of items)
                    for (var r=0;r<symValue.length;r++) {
						// console.log("Binding.elaborateNode("+idStem+") iterable index=  "+r);
						if(symValue[r] || (symValue===false)) {   
							var repId=Binding.createUniqueId(node.id);//idStem+"$"+node.id+"$"+r; 
                            var scopeStackLength=this.scopeStack.length;
							
							// iteration uses the current scope - but an new iteration scope  is pushed for each repetition 
							var iterationState=new IterationState(symValue[r],r, node.id,repId,); 
							
							
							// simple iteration works by pushing a single frame - the iteration state frame onto the ScopeStack
							// the iteration object is added to the state frame under the repId ( idStem$nodeId$index)
							// and the id of the new element is set to the same string - so that elaborateNode can make the match
							// push scope objects onto the stack
							this.scopeStack.push( new StackFrame(repId,iterationState) );
							
							// clone the full tree of the node in the template
							var repElement=node.cloneNode(true);  
							
                            // must use the iterationId as the element id here or the algorithm recurses infinitely
							var repContent=this.elaborateNode(repElement  );
							
							// maintain map of symbolic references
							Binding.setSymbol(repElement, node.id, repId);
							
							repElement.id=repId;
                            repContent.modelObj=symValue[r];
                                                        
							// dom should link back to only one view element
							// be aware of GroupWrapper objects here it may not have a ..classList or ..classList.contains
							repContent.forEach( function(e) { if (e.classList && e.classList.contains("dt-attach-model")) { if (!symValue[r].dt$dom)symValue[r].dt$dom=[]; symValue[r].dt$dom.push(e)}});
							
							// pop the  stack - restore to scopeStackLength
							this.scopeStack.setLength(scopeStackLength);
							nodesOut=nodesOut.concat(repContent);
						} else {
							// nothing to do
						}
					}
                } else if  (symValue) {
                    // console.log("Binding.elaborateNode() ELEMENT_NODE - element id "+node.id+" resolves to a new scope object");
                    // single object  
					var repId= Binding.createUniqueId(node.id); //idStem+"$"+node.id+"$";					
					//newNode=this.expressObject(node, repId, symValue );
					 
					// console.log("Binding.expresObject() ELEMENT_NODE - element id "+node.id+" resolves to a new scope object"); 
					var scopeStackLength=this.scopeStack.length;
					this.scopeStack.push(new StackFrame(node.id,symValue ));
 
					// mapAttributes() resolves with the new scope object -- the id of the new node will be the function name if the id referenced a function
					newNode=this.cloneAndBindElement(node,  this.mapAttributes(node));
				
					// maintain map of symbolic references
					Binding.setSymbol(newNode,node.id,repId);

					newNode.id=repId;
				
					// attach fwd & bkwd link from view to model
					newNode.modelObj=symValue;
				
					// be aware of GroupWrapper objects here it may not have a ..classList or ..classList.contains
					//{ if (e.classList && e.classList.contains("dt-attach-model")) { if (!symValue[r].dt$dom)symValue[r].dt$dom=[]; symValue[r].dt$dom.push(e)}}
					if (newNode.classList && newNode.classList.contains("dt-attach-model")) { if (!symValue.dt$dom) scopeObj.dt$dom=[];symValue.dt$dom.push(newNode)};
	
					// pop the  stack - restore to scopeStackLength
					this.scopeStack.setLength(scopeStackLength); 
					
					nodesOut.push(newNode);  
                } else {
                    //console.log("Binding.elaborateNode() ELEMENT_NODE - id "+node.id+" not resolved");
                    newNode=this.cloneAndBindElement(node,  this.mapAttributes(node)); 
					
					newNode.id=Binding.createUniqueId(node.id);//idStem+"$"+node.id 
					Binding.setSymbol(newNode,node.id,newNode.id);
					
					// maintain map of symbolic references
					if ( !newNode.dt$symboltable) newNode.dt$symboltable={};
					newNode.dt$symboltable[node.id]=newNode.id;
					
                    nodesOut.push(newNode); 
                }
            } else {
                console.log("Binding.elaborateNode() ELEMENT_NODE - element has no id attribute");
                newNode=this.cloneAndBindElement(node,  this.mapAttributes(node) );
                nodesOut.push(newNode); 
            } 
        } else if (node.nodeType==Node.TEXT_NODE) {
            // console.log("Binding.elaborateNode() TEXT_NODE "+ node.nodeValue);
            // newNode=node.cloneNode(false);
            // newNode.nodeValue= this.resolveEmbeddedSymbols(node.nodeValue) ;
            // nodesOut.push(newNode);
            
            var embedded = this.resolveEmbeddedSymbols(node.nodeValue) //will return an array of nodes
            for (var ti=0; ti<embedded.length; ti++) {
                if (typeof embedded[ti]   === 'string'  ){
                    nodesOut.push(document.createTextNode(embedded[ti]));
                } else if (typeof embedded[ti]   === 'number'  ){
                    nodesOut.push(document.createTextNode(embedded[ti]));
                }  else if (embedded[ti].nodeType) {
                   nodesOut.push( embedded[ti] );
                }
            }
        }
    return(nodesOut);
}

Binding.createUniqueId=function(stem) { 
	if (stem) return (stem+"$"+Binding.idCounter++);
	return ("$"+Binding.idCounter++)
}

Binding.setSymbol=function(ele, symbol, symVal) {
	if ( !ele.dt$symboltable)ele.dt$symboltable={};
	ele.dt$symboltable[symbol]=symVal;
}

/* 
 a fragment is a object with a .childNodes property containing an iterable list of DOM Node objects
*/
Binding.prototype.elaborateFragment=function (fragment ) {
   // console.log("Binding.elaborateFragment");   
   var nodesOut=[];
   var nodesIn=fragment.childNodes;
   
   for (var ix=0; ix<nodesIn.length; ix++) {
        var node=nodesIn[ix]; 
        
        // if this the 1st of a group??
        if ( GroupWrapper.isGroupStart(node)) {
            // handle the group as a single fragment - newGroup consumes all of the elements up to the end 
            var nodeGroup=GroupWrapper.newGroup(nodesIn,ix);
            ix += nodeGroup.templateNodeCount; 
			// elaborate the grouping element
            var groupOutput = this.elaborateNode(nodeGroup );
            nodesOut=nodesOut.concat( GroupWrapper.unwrap(groupOutput));
        } else if ( GroupWrapper.isGroupElement(node)) {
            node.isWrapper=true; // set this flag on the node so that the unwrap method recognises it as a wrapper
            // this is an element with a dt-unwrap class or some other indicator that it represents a group so the element's children 
            // are promoted to the level of the element, and the element 'node' iteslf is dropped
            var groupOutput = this.elaborateNode(node );
			// unwrap removes the enclosing element
            nodesOut=nodesOut.concat( GroupWrapper.unwrap(groupOutput));
        } else {
            // handle a single node
            nodesOut=nodesOut.concat(this.elaborateNode(node ));
        }
    }
    
    // a list of new elements is returned and the template is unchanged    
    if (nodesOut.indexOf(undefined)>=0){
        console.log("Binding.elaborateFragment(): null element in output.");
    } 
    return (nodesOut);
}

// applybinding to any elements with class 'dt-auto'
Binding.autoExpress = function() {
	
	/* auto-express requires a template name and an element name */
	/* nee a rule of thumb to automatically associate these      */
	/* element.id ==xxx template.id = dt$xxx; variable name  xxx of the window scope is the variable to merge */
	
	var templates=document.getElementsByTagName("template");
	
	var i;
	for (i = 0; i < templates.length; i++) if (templates[i].classList.contains("dt-auto")){
		var t=templates[i]; 
		var scope={}; 
		var addContent=new Binding( [ new StackFrame(t.id, window)]).elaborateFragment(t.content ); 
		var x;
		// insert new content immediately after the template
		for( x=0;x<addContent.length;x++) {
		    // insert after
			t.parentNode.insertBefore(addContent[x], t.nextSibling);
			t=addContent[x];
		}
	}
	
}

function IterationController(iterationId, symbolId,  iterable) { 
	this.symbolId= symbolId;
	this.iterationId=iterationId; 
	this.index=-1;
	this.iterable=iterable;
    this.length=iterable.length;
}

IterationController.prototype.next=function() {
    if (this.iterable && this.iterable.length>(this.index+1)) {
	    //this.iterable[this.index].$index=this.index;
        return(this.iterable[++this.index]);
	} else {
	   return (null);
	}
}

IterationController.prototype.hasMore=function() {
    return this.iterable && this.index<this.iterable.length-1
}
function GroupWrapper(eleId) {
    // make a fake Element Node
    this.nodeType=Node.ELEMENT_NODE
    this.attributes=[];
    this.isWrapper=true;
    this.id=eleId;
    this.childNodes=[];
       
    // this counts the total number of template nodes spanned by the group
    // including any groups enclosed in this one, and this number is used to skip over these nodes
    // in Binding.prototype.elaborateFragment()
    this.templateNodeCount=0;
}

GroupWrapper.isGroupStart=function (node) {
    return ((node.nodeType==Node.ELEMENT_NODE)  && (node.classList.contains("dt-group-start")));
}

GroupWrapper.isGroupEnd=function(node) {
    return ((node.nodeType==Node.ELEMENT_NODE)  && (node.classList.contains("dt-group-end")));
}

GroupWrapper.isGroupElement=function (node) {
    return ((node.nodeType==Node.ELEMENT_NODE)  && (node.classList.contains("dt-unwrap")));
}

GroupWrapper.newGroup=function(nodeList, startIndex ){
    var ix=startIndex;
    var grp=new GroupWrapper(nodeList[ix].id);
    var node=nodeList[ix];

    // consume 1st node 
    grp.templateNodeCount=1;
    grp.childNodes.push(node);
    
    // this is mutating the template so must be done on a copy of the template content
    node.classList.remove("dt-group-start");
    node.id="";
    
    // process the following nodes up to and including the end of the group
    for(ix++;ix<nodeList.length;ix++) {      
       // move on to next node
       node=nodeList[ix];
       
       // recurse if is the next node a group start?
       if (GroupWrapper.isGroupStart(node)) {
           // a nested group
           var nestedGrp=GroupWrapper.newGroup(nodeList,ix);
           grp.templateNodeCount+=nestedGrp.templateNodeCount;
           grp.childNodes.push(nestedGrp);
       } else {
           grp.templateNodeCount++;
           grp.childNodes.push(node);
       }    
       
       // is that the last node in a group??
       if(GroupWrapper.isGroupEnd(node)) {
           node.classList.remove("dt-group-end");
           return (grp);
       }
    }
    return (grp);      
}

GroupWrapper.unwrap=function( nodeList) {
    var outList=[];
    
    for (var ix=0; ix<nodeList.length; ix++) {
        if (nodeList[ix].isWrapper) {
            outList=outList.concat( nodeList[ix].unwrap())
        } else {
            outList.push(nodeList[ix]);
        }
    }
    return(outList);
}

GroupWrapper.prototype.unwrap=function() {
    return (GroupWrapper.unwrap(this.childNodes));
}

// implement cloneNode - this is one of the few methods of a DOM Element objct
// that is required 
GroupWrapper.prototype.cloneNode=function(deep) {
    var newInstance= new GroupWrapper(this.id);
    newInstance.templateNodeCount=this.templateNodeCount;

    if (deep) {
        for (var i=0; i<this.childNodes.length; i++) {
            newInstance.childNodes.push(this.childNodes[i].cloneNode(true));
        }
    }     
    return(newInstance);
}

GroupWrapper.prototype.appendChild=function( node) {
    // node this does not have to increment nodeCount
    // nodeCount counts the number of input nodes in the template, not the number of nodes in the output
    this.childNodes.push(node);
}

document.addEventListener("DOMContentLoaded", Binding.autoExpress);