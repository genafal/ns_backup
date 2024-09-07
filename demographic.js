console.log("Script is running");
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded and parsed");
    d3.csv("data.csv").then(function (data) {
        console.log("Loaded Data:", data); // Check if data is loaded correctly

        // Run visualization after defining it
        scatterPlotVisualization(data);
    });

    // Define custom orders for each axis category
    const orders = {
        "age_group": ["Age 4-9", "Age 10-12", "Age 13-15", "Age 16-19", "Age 20-24", "Age 25+", "Unknown"],
        "location": ["Bath", "Bournemouth", "Cambridge", "Chelmsford", "Colchester", "Ipswich", "Milton Keynes", "Lincoln", "London", "Norwich", "Peterborough", "Romford", "St. Albans", "Salisbury", "Stevenage"],
        "ethnicity": ["Asian", "Black", "White", "Mixed", "Declined to say", "Unknown"],
        "gender": ["Female", "Male", "Other", "Declined to say", "Unknown"],
        "participant_industry": ["Education", "Local Government", "Mental Health", "Other", "Unknown"],
        "has_external_interaction": ["Yes", "No"]
    };

    // Add the tooltip selection
    const tooltip = d3.select("#tooltip");

    // Function for the scatter plot visualization
    function scatterPlotVisualization(data) {
        const xAxisDropdown = d3.select("#x-axis").node();
        const yAxisDropdown = d3.select("#y-axis").node();

        if (!xAxisDropdown) {
            console.error("The #x-axis dropdown is not found.");
        } else {
            console.log("X-Axis Dropdown Element:", xAxisDropdown);
        }

        if (!yAxisDropdown) {
            console.error("The #y-axis dropdown is not found.");
        } else {
            console.log("Y-Axis Dropdown Element:", yAxisDropdown);
        }

        // Set up dimensions and SVG container
        const svg = d3.select("svg"),
              margin = { top: 20, right: 30, bottom: 80, left: 150 },
              width = svg.attr("width") - margin.left - margin.right,
              height = svg.attr("height") - margin.top - margin.bottom,
              g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Append axis groups within this function
        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
        g.append("g").attr("class", "y-axis");

        // Create dropdown options for scatter plot axes
        // const categoricalColumns = ["age_group", "gender", "ethnicity", "location", "participant_industry", "has_external_interaction"];
        const categoricalColumns = [
            ["Age Group", "age_group"], 
            ["Gender", "gender"], 
            ["Ethnicity", "ethnicity"], 
            ["Location", "location"], 
            ["Participant Industry", "participant_industry"], 
            ["Has External Interaction", "has_external_interaction"]
        ];

        categoricalColumns.forEach((col, index) => {
            d3.select("#x-axis").append("option").text(col[0]).attr("value", col[1]).property("selected", index === 0);
            d3.select("#y-axis").append("option").text(col[0]).attr("value", col[1]).property("selected", index === 1);
        });

        let xAxisCategory = d3.select("#x-axis").property("value");
        let yAxisCategory = d3.select("#y-axis").property("value");

        // Set up scales
        // // force as much space as possible between the bands to minimize cluster overlap
        // let xScale = d3.scaleBand().range([0, width]).paddingInner(0.3).padding(0.05);
        // let yScale = d3.scaleBand().range([height, 0]).paddingInner(0.3).padding(0.05);
        const colorScale = d3.scaleOrdinal()
            .domain(["Positive", "No change", "Negative"])
            .range(["#beff00", "#4F9DE0", "#6C44CC"]);
        const sizeScale = d3.scaleLinear().range([3, 10]); // Scale for circle sizes

        // Add a color legend based on the change_reported column
        const legendData = colorScale.domain(); // ["Positive", "No change", "Negative"]

        const legend = d3.select("#legend")
            .append("svg")
            .attr("width", "100%")
            .attr("height", 50) // Adjust height based on the number of legend items
            .selectAll(".legend-item")
            .data(legendData)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(${i * 160}, 0)`);
            

        legend.append("circle")
            .attr("cx", 10) // Adjust the x position for the circle's center
            .attr("cy", 19) // Adjust the y position for the circle's center
            .attr("r", 9) // Set the radius of the circle
            .attr("fill", d => colorScale(d));

        legend.append("text")
            .attr("x", 25)
            .attr("y", 20)
            .attr("dy", ".35em")
            .text(d => d)
            .style("fill", "white"); // Adjust the text color as needed

        function updateScatterPlot() {
            xAxisCategory = d3.select("#x-axis").property("value");
            yAxisCategory = d3.select("#y-axis").property("value");

            // Log the selected axis categories
            console.log("Selected X-Axis Category:", xAxisCategory);
            console.log("Selected Y-Axis Category:", yAxisCategory);

            // Log the custom order retrieved from orders
            console.log("X-Axis Custom Order:", orders[xAxisCategory]);
            console.log("Y-Axis Custom Order:", orders[yAxisCategory]);

            let xRangeValues = [];
            let yRangeValues = [];

            // Calculate xRangeValues
            orders[xAxisCategory].forEach((xCategory,i) => {
                // set a minimum amount for the width of each category
                let maxX = 82;
                orders[yAxisCategory].forEach(yCategory => {
                    // find the number of data points in each coordinate group
                    let subgroup = data.filter(d => d[yAxisCategory] === yCategory && d[xAxisCategory] === xCategory)
                    if (subgroup.length > 0) {
                        // express the group as a percentage of the width based on the proportion of points
                        let x = (subgroup.length/data.length) * width
                        // check if this group is larger than our minimum or larger than previous groups
                        //maxX = maxX < x ? x : maxX;
                        maxX = Math.max(maxX, x);
                    }
                })
                // calculate the width, start pixels, center pixels, and end pixels for each category
                let pushValue = {width: maxX, end: i === 0 ? maxX : maxX + xRangeValues[i-1].end};
                pushValue.start = pushValue.end - pushValue.width;
                pushValue.center = pushValue.start + (pushValue.width/2);
                xRangeValues.push(pushValue);
            });

            orders[yAxisCategory].forEach((yCategory,i) => {
                let maxY = 82;
                orders[xAxisCategory].forEach(xCategory => {
                    let subgroup = data.filter(d => d[yAxisCategory] === yCategory && d[xAxisCategory] === xCategory)
                    if (subgroup.length > 0) {
                        let y = (subgroup.length/data.length) * height
                        //maxY = maxY < y ? y : maxY;
                        maxY = Math.max(maxY, y);
                    }
                })
                let pushValue = {width: maxY, end: i === 0 ? maxY : maxY + yRangeValues[i-1].end};
                pushValue.start = pushValue.end - pushValue.width;
                pushValue.center = pushValue.start + (pushValue.width/2);
                yRangeValues.push(pushValue);
            })
            // adjust the final dimensions of the svg to fit the data grid
            const finalWidth = xRangeValues.map(m => m.width).reduce((p, a) => p + a);
            const finalHeight = yRangeValues.map(m => m.width).reduce((p, a) => p + a);
            svg.attr("width", finalWidth + margin.left + margin.right)
            svg.attr("height", finalHeight + margin.top + margin.bottom)

            // Apply custom order for x-axis and y-axis
            // base the scale breaks on the centers for each category
            let xScale = d3.scaleOrdinal()
                .range(xRangeValues.map(d => d.center))
                .domain(orders[xAxisCategory]);

            let yScale = d3.scaleOrdinal()
                .range(yRangeValues.map(d => d.center).reverse())
                .domain(orders[yAxisCategory].reverse()); // reverse if you want your prescribed order to read top to bottom
                //.domain(orders[yAxisCategory]); // No need to reverse the domain; only the range

            // Ensure y-axis only updates when y-axis dropdown changes
            d3.select("#x-axis").on("change", function() {
                xAxisCategory = this.value;
                console.log("X-axis updated to:", xAxisCategory);
                xScale.domain(orders[xAxisCategory]);
                updateScatterPlot(); // Re-run the function to update x-axis
            });

            d3.select("#y-axis").on("change", function() {
                yAxisCategory = this.value;
                console.log("Y-axis updated to:", yAxisCategory);
                yScale.domain(orders[yAxisCategory]);
                yScale.range(yRangeValues.map(d => d.center).reverse()); // Ensure y-axis is reversed correctly on change
                updateScatterPlot(); // Re-run the function to update y-axis
            });

            sizeScale.domain([0, d3.max(data, d => d.size_of_change)]);

            // Additional logs after creating scales
            console.log("Sample X Scale Value:", xScale(data[0][xAxisCategory]));
            console.log("Sample Y Scale Value:", yScale(data[0][yAxisCategory]));

            // Initialize the force simulation
            const simulation = d3.forceSimulation(data)
            .force("x", d3.forceX(d => xScale(d[xAxisCategory])).strength(1))
            .force("y", d3.forceY(d => yScale(d[yAxisCategory])).strength(1))
            .force("collide", d3.forceCollide(d => sizeScale(d.size_of_change) + 1)) // Fine-tune the collision radius

            // Run the simulation for a fixed number of iterations to ensure stability
            for (let i = 0; i < 300; i++) simulation.tick();

            // Bind data to circles
            g.selectAll("circle")
                .data(data)
                .join("circle")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", d => sizeScale(d.size_of_change))
                .attr("fill", d => colorScale(d.change_reported))
                .attr("stroke", "#333")
                .attr("opacity", 0.9)
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`
                    <strong>Size of Change:</strong> ${d.size_of_change}<br>
                    <strong>Age Group:</strong> ${d.age_group}<br>
                    <strong>Gender:</strong> ${d.gender}<br>
                    <strong>Location:</strong> ${d.location}<br>
                    <strong>Ethnicity:</strong> ${d.ethnicity}<br>
                    <strong>Industry:</strong> ${d.participant_industry}<br>
                    <strong>External Interaction:</strong> ${d.has_external_interaction}
                    `)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
                })
                .on("mousemove", function(event) {
                    tooltip.style("left", (event.pageX + 5) + "px")
                           .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                });

            // the enter/append/merge/exit methodology is old d3
            // using join is the current preferred method

            // Update the axis groups after creation
            if (g.select(".x-axis").node()) {
                g.select(".x-axis").call(d3.axisBottom(xScale)).attr("transform", `translate(0,${finalHeight})`);
                // use very faint gridlines to help the eye connect the intersecting categories for each group
                g.selectAll(".x-axis .tick line").attr("y2", -finalHeight).style("opacity", .5).style("stroke-width", .5);
            }

            if (g.select(".y-axis").node()) {
                g.select(".y-axis").call(d3.axisLeft(yScale));
                g.selectAll(".y-axis .tick line").attr("x2", finalWidth).style("opacity", .5).style("stroke-width", .5);
            }
            // remove the domain lines for both axes
            g.selectAll("path.domain").remove();
        }


        // Initial render of the scatter plot
        updateScatterPlot();

        // Update plot when x-axis or y-axis changes
        d3.select("#x-axis").on("change", function () {
            xAxisCategory = this.value;
            updateScatterPlot();
        });

        d3.select("#y-axis").on("change", function () {
            yAxisCategory = this.value;
            updateScatterPlot();
        });
    }

});