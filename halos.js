// DarkSky Halo Browser app

//Create SVG element                                      	
var svg = d3.select("body").append("svg");

// get width and height of canvas (strip off "px")
var scr_w = svg.style("width").replace (/[^0-9]/g, '');                             	
var scr_h = svg.style("height").replace (/[^0-9]/g, '');
var trans_len = 100;

// halo scatter plot
var pad = 100;
var halo_plot_h;
var halo_plot_w = scr_w - 2*pad;
var halo_plot_nticks = 5;
var halo_plot_nbins = 20;
var halo_plot = svg.append("g")
	.attr("id", "halo_plot");
var halo_plot_scale_r, halo_plot_scale_theta, halo_plot_scale_phi;
var halo_dots;
var sel_arc;
var sel_z, sel_dz;

// mass histogram
var mass_hist_w;// = 0.5*(scr_w - 3*pad);
var mass_hist_h;// = 0.5*(scr_h - 3*pad);
var mass_hist_nbins = 40;
var mass_hist_nticks = 5;
var mass_hist = svg.append("g")
	.attr("id", "mass_hist");
var mass_hist_scale_m, mass_hist_scale_f;
var mass_bars;

// data array
var halos = [];
var halo_range_x, halo_range_y, halo_range_z, halo_range_m;

// data proxies for scaling dots
// x, y, z, id are assumed to exist in each element
var mass = "m200b";
var size = "r200b";

queue().defer(d3.csv, "data/ds14_a_halos_lc_4000_thinnest.dat", function(d) {
		
		if(d[mass] == 0) return; // ignore zero-mass halos
		d.id = parseInt(d.id);
		d[mass] = Math.log10(parseFloat(d[mass])); // store log(mass)
		d[size] = parseFloat(d[size]);
		
		d.r = parseFloat(d.r);
		d.t = parseFloat(d.t);
		d.p = parseFloat(d.p);
		d.z = parseFloat(d.z);

		halos.push(d);
	})
	.await(ready);

                                                 	
// data are ready             	
function ready(error) {	

	// TODO: handle errors
	
	// get comoving distance range
	halo_range_z = d3.extent(halos, function(d) {
		return d.z;
	});
	halo_range_z[0] = 0;
	halo_range_theta = d3.extent(halos, function(d) {
		return d.t;
	});
	halo_range_phi = d3.extent(halos, function(d) {
		return d.p;
	});
	halo_range_m = d3.extent(halos, function(d) {
		return d[mass];
	});
	
	// get size of the halo plot
	var half_phi = 0.5*(halo_range_phi[1] - halo_range_phi[0]);
	halo_plot_h = 2*halo_plot_w*Math.sin(half_phi);
	console.log(halo_plot_h);
	halo_plot.attr("transform", "translate(" + pad + "," + (pad + 0.5*halo_plot_h) + ")");
	

	// data scales 
	halo_plot_scale_r = d3.scale.linear()
		.domain(halo_range_z)
		.range([0, halo_plot_w]);
	halo_plot_scale_phi = d3.scale.linear()
		.domain(halo_range_phi)
		.range([halo_plot_h, 0]);
	halo_plot_scale_theta = d3.scale.linear()
		.domain(halo_range_theta)
		.range([0, 1]);
	
	// make halo axes
	var halo_plot_xaxis = d3.svg.axis().scale(halo_plot_scale_r).orient("bottom").ticks(halo_plot_nticks);
	var halo_plot_yaxis = d3.svg.axis().scale(halo_plot_scale_phi).orient("left").ticks(halo_plot_nticks);
	halo_plot.append("g").attr("class", "axis")
		.attr("transform", "rotate(" + (90*(halo_range_phi[1] - halo_range_phi[0])/Math.PI) +")").call(halo_plot_xaxis)
		.append("text").attr("class", "axis label")
		.attr("transform", "translate(" + 0.5*halo_plot_w + "," + 0.4*pad + ")")
		.attr("text-anchor", "middle")
		.text("redshift");
	halo_plot.append("g").attr("class", "axis")
		.attr("transform", "rotate(" + (-90*(halo_range_phi[1] - halo_range_phi[0])/Math.PI) +")scale(1,-1)").call(halo_plot_xaxis)
		.selectAll("text").remove(); // remove numbers on top axis
	
	// plot haloes
	var map = map_wedge(halo_range_z, halo_range_phi, [0, halo_plot_w], [-0.5*halo_plot_h, 0.5*halo_plot_h]);
	halo_dots = halo_plot.selectAll(".halo").data(halos).enter()
		.insert("circle", ".axis")
		.sort(function(a, b) {
			return a.t < b.t;
		})
		.attr("class", "halo")
		.attr("cx", function(d) {
			return map([d.z, d.p])[0];
		})
		.attr("cy", function(d) {
			return map([d.z, d.p])[1];
		})
		.attr("r", function(d) {
			//return 0.0000000005*halo_plot_w*Math.sqrt(Math.pow(10, d[mass]));
			return 3*d[size];
		})
		.style("fill",  function(d) {
			return "rgb(" + (Math.round(255*d.z/halo_range_z[1])) + ",0," + (Math.round(255*(1.0 - d.z/halo_range_z[1]))) + ")"
		});

	halo_dots.on("mouseover", function(d) {
			draw_tooltip_halo(d);
			d3.select(this).classed("selected", true);
		})
		.on("mouseout", function(d) {
			svg.select("#tooltip-halo").remove();
			d3.select(this).classed("selected", false);
		});
	
	// add the mass selection arc
	sel_z = 0.1;
	sel_dz = 0.05;
	sel_arc = d3.svg.arc()
		.innerRadius(halo_plot_scale_r(sel_z - 0.5*sel_dz))
		.outerRadius(halo_plot_scale_r(sel_z + 0.5*sel_dz))
		.startAngle(0.5*Math.PI - half_phi) //converting from degs to radians
		.endAngle(0.5*Math.PI + half_phi) //just radians
	var drag = d3.behavior.drag()
    	.on("drag", function(d) {
			var r_new = Math.sqrt(d3.event.x*d3.event.x + (d3.event.y - 0.5*halo_plot_h)*(d3.event.y - 0.5*halo_plot_h));
			sel_z = halo_plot_scale_r.invert(r_new);
			sel_z = Math.min(sel_z, halo_range_z[1] - 0.5*sel_dz);
			sel_z = Math.max(sel_z, 0.5*sel_dz);
			sel_arc
				.innerRadius(halo_plot_scale_r(sel_z - 0.5*sel_dz))
				.outerRadius(halo_plot_scale_r(sel_z + 0.5*sel_dz));
			d3.select(this).attr("d", sel_arc);
		})
		.on("dragend", draw_mass_hist);
	halo_plot.append("path")
		    .attr("d", sel_arc)
			.attr("id","selection_arc")
			//.attr("transform", "translate(0," + (0.5*halo_plot_h) + ")")
			.call(drag);

	// determine the mass histogram scale
	mass_hist_w = 0.5*(scr_w - 2*pad);
	mass_hist_h = scr_h - 2.5*pad - halo_plot_h;
	mass_hist.attr("transform", "translate(" + (1.5*pad) + "," + (1.5*pad + halo_plot_h) + ")");
	mass_hist_scale_m = d3.scale.linear()
		.domain(halo_range_m)
		.range([0, mass_hist_w]);
	draw_mass_hist();

	// draw title
	svg.append("text")
		.attr("id", "my-title")
		.attr("x", 0.75*pad)
		.attr("y", 0.75*pad)
		.text("DarkSky Halo Browser");

}


function draw_mass_hist() {

	mass_hist.selectAll(".bar").remove();
	mass_hist.selectAll(".axis").remove();

	// data scales 

	var mass_data = d3.layout.histogram()
	    	.bins(mass_hist_scale_m.ticks(mass_hist_nbins))
			.value(function(d) {
				return d[mass];
			})(halos.filter(function(d) {
					return d.z > (sel_z - 0.5*sel_dz) && d.z < (sel_z + 0.5*sel_dz);
				}));

	// log-scale the histogram
	mass_data.forEach(function(d) {
		d.y = Math.log10(d.y);
	});
	var mass_range = d3.max(mass_data, function(d) {
		return d.y;
	});
	mass_hist_scale_f = d3.scale.linear()
		.domain([mass_range, 0.0])
		.range([0, mass_hist_h]);
	
	// make mass hist axes
	var mass_hist_xaxis = d3.svg.axis().scale(mass_hist_scale_m).orient("bottom").ticks(mass_hist_nticks);
	var mass_hist_yaxis = d3.svg.axis().scale(mass_hist_scale_f).orient("left").ticks(mass_hist_nticks);
	mass_hist.append("g").attr("class", "axis")
		.attr("transform", "translate(0," + mass_hist_h + ")").call(mass_hist_xaxis)
		.append("text").attr("class", "axis label")
		.attr("transform", "translate(" + 0.5*mass_hist_w + "," + 0.4*pad + ")")
		.attr("text-anchor", "middle")
		.text("log[M]");
	mass_hist.append("g").attr("class", "axis").call(mass_hist_yaxis)
		.append("text").attr("class", "axis label")
		.attr("transform", "translate(" + -0.4*pad + "," + 0.5*mass_hist_h + ")rotate(-90)")
		.attr("text-anchor", "middle")
		.text("log[dN/dlog[M]]");

	// draw histogram bars
	mass_bars = mass_hist.selectAll(".bar")
	    .data(mass_data).enter().insert("rect", ".axis").attr("class", "bar")
		.attr("x", function(d) {
			return mass_hist_scale_m(d.x) + 1;
		})
		.attr("y", function(d) {
			return mass_hist_scale_f(d.y);
			//return mass_hist_scale_f(Math.log10(d.y));
		})
		.attr("width", function(d) {
			return mass_hist_scale_m(d.x + d.dx) - mass_hist_scale_m(d.x) - 1;
		})
		.attr("height", function(d) {
			return mass_hist_h - mass_hist_scale_f(d.y);
			//return mass_hist_h - mass_hist_scale_f(Math.log10(d.y));
		});

	mass_bars.on("mouseover", function(d) {
		d3.select(this).classed("selected", true);
		halo_dots.classed("selected", function(h) {
				return h.z > (sel_z - 0.5*sel_dz) && h.z < (sel_z + 0.5*sel_dz)
					&& h[mass] >= d.x && h[mass] < (d.x + d.dx);
			});
	})
	.on("mouseout", function(d) {
		d3.select(this).classed("selected", false);
		halo_dots.classed("selected", false);
	});





}


function draw_tooltip_halo(d) {
	var tt_x = 3*pad + mass_hist_w; var tt_y = halo_plot_h + 2*pad;

	var tt = svg.append("text")
		.attr("id", "tooltip-halo")
		.attr("x", tt_x)
		.attr("y", tt_y)
		.style("opacity", 1.0);
	
	for(name in d) {
		tt.append("tspan").attr("x", tt_x).attr("dy", "1.2em")
			.text(name + " = " + function(_) {
				if(name == "id") return d[name];
				if(name == "r" || name == "theta" || name == "phi") return d[name].toPrecision(3);
				if(name == mass) return Math.pow(10, d[mass]).toPrecision(3);
				return d[name];
			}());
		// TODO: print mass nicely
	}
}

function map_wedge(range_r, range_phi, range_x, range_y) {
	
	// rotate phi s.t. it is centered at 0	
	var half_phi = 0.5*(range_phi[1] - range_phi[0]);
	var scale_phi = d3.scale.linear()
		.domain(range_phi)
		.range([-half_phi, half_phi]);

	// assume that range_r and range_x both start at 0!!!
	var scale_x = d3.scale.linear()
		.domain(range_r)
		.range(range_x);

	var mid_y = 0.5*(range_y[0] + range_y[1]);
	var dist_y = range_r[1]*Math.sin(half_phi);
	var scale_y = d3.scale.linear()
		.domain([-dist_y, dist_y])
		.range([mid_y - scale_x(dist_y), mid_y + scale_x(dist_y)]);

	return function(polar) {
		var r = polar[0];
		var phi = scale_phi(polar[1]);
		var x = r*Math.cos(phi);
		var y = r*Math.sin(phi);
		return [scale_x(x), scale_y(y)];
	}
}
     
