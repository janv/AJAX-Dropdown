/*
 * 	<%= f.text_field :leiter_id,
                     :class => "ajax_dropdown",
                     :datasrc => find_json_people_path,
                     :original_content => f.object.leiter.description,
                     :callback => "some_js_callback_code();" %>       Callback Code is executed in the context of the input field whenever the value changes
 */
var AJAXDropdown = (function(){
	
	/* Create the hidden field that holds the ID */
	function make_hidden_field(inputfield) {
		inputfield.after('<input type="hidden" readonly="true" name="' + inputfield.attr("name") + '" value="' + inputfield.val() +'"/>')
		inputfield.val(inputfield.attr("original_value"))
		inputfield.removeAttr("name")
		return inputfield.next()[0]
	}
	
	/* Create the Dropdownlost as a hidden layer, install handlers */
	function make_ajax_list(inputfield) {
		inputfield.after("<div class=\"ajax_dropdown_div\"><span></span><table></table></div>")
		var dj = inputfield.next()
		var d  = dj[0]
		
		//Style
		dj.css("position", "absolute")
		var offset = inputfield.offset()
		dj.css("left", offset.left)
		dj.css("top", offset.top+inputfield.height()+30)
		dj.css("display", "none")
		
		//Handlers
		$("table", d).mousedown(function(){
			d.pass_selected_value()
			if (inputfield[0].callback) inputfield[0].callback.apply(inputfield[0])
		})
		
		//Functions
		
		//Move selected up
		d.up   = function(){
			var current = $(".selected", dj)
			if (current.length == 0) {
				$("tr:last", dj).addClass("selected")
			} else {
				current.removeClass("selected")
				if (current.prev().length != 0)
					current.prev().addClass("selected")
				else
					current.siblings(":last").addClass("selected")
			}
		}
		
		//Move selected down
		d.down = function(){
			var current = $(".selected", dj)
			if (current.length == 0) {
				$("tr:first", dj).addClass("selected")
			} else {
				current.removeClass("selected")
				if (current.next().length != 0)
					current.next().addClass("selected")
				else
					current.siblings(":first").addClass("selected")
			}
		}
		
		d.deselect_all = function() {
			$("tr", dj).removeClass("selected")
		}
		
		//Hide and Show
		d.hide = function(){ dj.hide() }
		d.show = function(){
			var offset = inputfield.offset()
			dj.css("left", offset.left)
			dj.css("top", offset.top+inputfield.height()+ 5)
			dj.show()
		}
		
		//Pass the currently selected Value to the Inputfield
		d.pass_selected_value = function() {
			var s = $(".selected", d)
			if (s.length > 0) {
				inputfield[0].update_from_list(s.attr("dropdown_id"),s.attr("dropdown_val"))
			} else {
				inputfield[0].update_from_list('','')
			}
		}
		
		//Set a message to appear on top of the list
		d.set_message = function(msg){
			$("span", dj).html(msg)
		}
		
		//Callback, executed when the query has changed
		d.query_changed = function(querystring){
			querystring = querystring.split(/,? +|,/)
			if (this.old_query != querystring[0]) {
				this.old_query = querystring[0]
				d.set_message("Wait")
				//AJAX request required, perform everything asynchronously
				inputfield[0].datasource.query(querystring[0], function(results){
					d.results = results
					if (results.length > 0) {
						if (results.length > 20) d.set_message("Bitte genauer")
						else                     d.set_message("")
					} else {
						d.set_message("Nichts gefunden")
					}
					d.filter_results(querystring)
				});
			} else {
				d.filter_results(querystring)
			}
			// var r = new RegExp(querystring, "i")
			// var highlighted_result = results[i][1].replace(r, '<strong>$&</strong>')
		}
		
		d.filter_results = function(filter) {
			var table = $("table", dj)
			table.empty()
			//generate RegExps
			var r1 = new RegExp(filter[0], "i")
			if (filter[1]) {
				var r2 = new RegExp(filter[1], "i")
				var rb = new RegExp(filter.join('|'), "ig")
			} else {
				var r2 = null
				var rb = new RegExp(filter[0], "ig")				
			}

			//create table rows
			for (var i=0; i < this.results.length; i++) {
				// var highlighted_result = this.results[i][1].replace(rb, '<strong>$&</strong>')
				if (this.results[i].join(' ').match(r1)) {
					if(r2==null || this.results[i].join(' ').match(r2)) {
						if (this.results[i].length == 2) {
							table.append('<tr dropdown_id="' + this.results[i][0] + '" dropdown_val="' + this.results[i][1] + '"><td>' + this.results[i][1].replace(rb, '<strong>$&</strong>') + '</td></tr>')
						} else {
							table.append('<tr dropdown_id="' + this.results[i][0] + '" dropdown_val="' + this.results[i][1] + '"><td>' + this.results[i][1].replace(rb, '<strong>$&</strong>') + '</td><td>' + this.results[i][2].replace(rb, '<strong>$&</strong>') + '</td></tr>')
						}						
					}
				}
			}
			//install handlers on table rows
			$("tr", table).mouseover(function(){
				d.deselect_all()
				$(this).addClass("selected")
			}).mouseout(function(){
				d.deselect_all()
			})
		}
		
		return d
	}

	/*
	 * [id, value, description]
	 * or [id, value]
	 */
	function Datasource(src) {
		this.src = src
		var data = null;
		try { data = eval("(" + src + ")") } catch (e) { }
		if (data != null) { //Offline Mode
			this.query = function(querystring, callback) {
				var retval = []
				for (var i=0; i < data.length; i++) {
					if (data[i][1].match(querystring)) retval.push(data[i]);
				}
				callback(retval)
			}
		} else { //AJAX Mode
			this.query = function(querystring, callback) {
				if (querystring.length < 3) {
					callback([])
				} else {
					$.getJSON(src, {"querystring":querystring}, function(data, textStatus){
						callback(data)
					})
				}
			}
		}
	}
	
	//Given a block of code in a string,
	//returns a function that implements that code and returns true
	function extract_callback(code){
	  if (code == undefined) {
	    return undefined
	  } else {
	    return eval("(function(){try{"+code+"}catch(e){alert('Exception in Callback!' + e.toString())};})")
	  }
	}
	
	function activate_input_field(){
		var inpf = $(this)
		//Input Feld aufbohren
		this.datasource  = new Datasource(inpf.attr("datasrc"))
		this.list        = make_ajax_list(inpf)
		this.hiddenfield = make_hidden_field(inpf)
		this.callback    = extract_callback(inpf.attr('callback'))
		
		this.update_from_list = function(id, value) {
			//TODO: Das muss anders gehen wenn es sich um ein multivalue Feld handelt
			this.value = value
			this.oldval = value
			this.hiddenfield.value = id
			this.list.hide();
		}
		
		// Keypress handling
		this.oldval = this.value
		inpf.keypress(function(e) {     //Navigation and Submitting
			if (e.keyCode == 38)        { //up
				this.list.up()
				e.preventDefault()
			} else if (e.keyCode == 40) { //down
				this.list.down()
				e.preventDefault()
			} else if (e.keyCode == 13) { //enter
				if ($(this.list).css("display") == "none") {
				  return true
				} else {
					this.list.pass_selected_value()
					if (this.callback) this.callback.apply(this)
					e.preventDefault();
					return false //don't submit form
				}
			}
		})
		inpf.keyup(function(e) {        //Entering letters
			if(e.keyCode != 13) //enter
			if(this.value != this.oldval) { //only operate on changes
				this.oldval = this.value
				this.hiddenfield.value = ''
				this.list.query_changed(this.value)
				this.list.show()
			}
		})

		//Other
		inpf.blur(function(){
			this.list.hide();
		})
		inpf.focus(function(){
			inpf.select()
			this.list.query_changed("");
			this.list.show();
		})
		inpf.attr("autocomplete", "off")
		
	}
	return { /* PUBLIC */
		activate_all : function(){ $(".ajax_dropdown").each(activate_input_field) }
		}
})()

$(function(){
	AJAXDropdown.activate_all()
})