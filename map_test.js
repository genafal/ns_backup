document.addEventListener("DOMContentLoaded", function () {

    function createChoroplethMap() {

        // Create a tooltip div that is hidden by default
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("padding", "8px")
            .style("background", "rgba(0, 0, 0, 0.7)")
            .style("color", "white")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        Promise.all([
            d3.json("uk_outcode_regions.geojson"),
            d3.csv("data_for_map.csv")
        ]).then(function([geojsonData, csvData]) {

            // Calculate the global maximum count across all age groups in the entire dataset
            const globalMax = d3.max(
                d3.rollups(
                    csvData,
                    v => v.length,
                    d => d.age_group
                ).map(([key, value]) => value)
            );

            console.log("Calculated globalMax:", globalMax);  // Debugging: Log the globalMax value

            const aggregatedData = d3.rollups(
                csvData,
                v => ({
                    average_score_change: d3.mean(v, d => +d.score_change),
                    count: v.length,
                    area: v[0].area,
                    region: v[0].region,
                    average_age: d3.mean(v, d => +d.start_age)
                }),
                d => d.outcode_alpha.trim().toUpperCase()
            );

            const dataMap = new Map(aggregatedData);

            geojsonData.features.forEach(feature => {
                const outcode_alpha = feature.properties.outcode_alpha ? feature.properties.outcode_alpha.trim().toUpperCase() : null;
                if (outcode_alpha) {
                    const data = dataMap.get(outcode_alpha) || { average_score_change: 0, count: 0 };
                    feature.properties.average_score_change = data.average_score_change;
                    feature.properties.count = data.count;
                    feature.properties.area = data.area;
                    feature.properties.region = data.region;
                    feature.properties.average_age = data.average_age;
                }
            });

            const svg = d3.select("#map")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 850 1250`)  // Ensure the viewBox uses the full intended size
                .attr("preserveAspectRatio", "xMidYMid meet");

            const minScore = d3.min(geojsonData.features, d => d.properties.average_score_change);
            const maxScore = d3.max(geojsonData.features, d => d.properties.average_score_change);

            const colorScale = d3.scaleDiverging()
                .domain([minScore, 0, maxScore])
                .interpolator(d3.interpolateRgbBasis(["#8755FF", "#E1E1E1", "#beff00"]));

            const projection = d3.geoMercator()
                .fitSize([850, 1250], {  // Adjust the fitExtent values to match the viewBox
                    type: "FeatureCollection",
                    features: geojsonData.features
                });

            const path = d3.geoPath().projection(projection);

            svg.selectAll("path")
                .data(geojsonData.features)
                .enter().append("path")
                .attr("d", path)
                .attr("fill", d => {
                    if (d.properties.count === 0) {
                        return "#333333";
                    } else if (d.properties.count > 0 && d.properties.average_score_change === 0) {
                        return "#E1E1E1";
                    } else {
                        return colorScale(d.properties.average_score_change);
                    }
                })
                .attr("stroke", "#000")
                .attr("stroke-width", "1.0px")

                // Tooltip events
                .on("mouseover", function(event, d) {
                    if (d.properties.count > 0) { // Only show tooltip if count > 0
                        tooltip.style("opacity", 1); // Show the tooltip immediately
                        tooltip.html(`
                            <strong>${d.properties.area}</strong>
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                    }
                })
                .on("mousemove", function(event) {
                    tooltip.style("left", (event.pageX + 10) + "px")
                           .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltipTimeout = setTimeout(() => {
                        tooltip.transition().duration(500).style("opacity", 0); // Fade out the tooltip after a delay
                    }, 100); // Small delay to prevent flicker during quick transitions between features
                })
                
                .on("click", function(event, d) {
                    console.log("Clicked region:", d.properties);  // Debugging: Log clicked region's properties
                    if (d.properties.count > 0) {
                        const area = d.properties.area;
                        const averageScoreChange = d.properties.average_score_change;
                        const count = d.properties.count;
                        const filteredData = csvData.filter(row => row.outcode_alpha.trim().toUpperCase() === d.properties.outcode_alpha.trim().toUpperCase());

                        // Update the info-box with the new data
                        d3.select("#info-box").html(`
                            <p><strong>${area}</strong><br><br>
                            <strong>${count}</strong> participant(s)<br><br>
                            Average score change: <strong>${averageScoreChange.toFixed(2)}</strong></p>
                        `);

                        const ageGroupData = d3.rollups(
                            filteredData,
                            v => v.length,
                            d => d.age_group
                        ).map(([key, value]) => ({ age_group: key, count: value }));

                        createBarChart(ageGroupData, "#bar-chart", globalMax);

                        // PIE CHART CODE
                        const ethnicityData = d3.rollups(
                            filteredData,
                            v => v.length,
                            d => d.ethnicity
                        ).map(([key, value]) => ({ ethnicity: key, count: value }));

                        createPieChart(ethnicityData, "#pie-chart-ethnicity", "Ethnicity");

                        const genderData = d3.rollups(
                            filteredData,
                            v => v.length,
                            d => d.gender
                        ).map(([key, value]) => ({ gender: key, count: value }));

                        createPieChart(genderData, "#pie-chart-gender", "Gender");

                        const industryData = d3.rollups(
                            filteredData,
                            v => v.length,
                            d => d.participant_industry
                        ).map(([key, value]) => ({ participant_industry: key, count: value }));

                        createPieChart(industryData, "#pie-chart-industry", "Participant Industry");
                      
                    }
                });
        }).catch(function(error) {
            console.error("Error loading the files: ", error);
        });
    }

    function createBarChart(data, selector, globalMax) {

        const margin = { top: 20, right: 30, bottom: 70, left: 40 }; // Increased bottom margin
        const container = d3.select(selector).node(); // Get the container element
        const width = container.getBoundingClientRect().width; // Get the container's width
        const aspectRatio = 600 / 250; // Original aspect ratio
        const height = width / aspectRatio; // Calculate height based on aspect ratio
        
        console.log("globalMax:", globalMax);  // Debugging: Log the globalMax value

        // Check if globalMax is valid
        if (isNaN(globalMax) || globalMax <= 0) {
            console.error("Invalid globalMax:", globalMax);
            globalMax = 10;  // Temporarily set to 10 for debugging
        }

        // Define the order and ensure all categories are present
        const categories = ["Age 4-9", "Age 10-12", "Age 13-15", "Age 16-19", "Age 20-24", "Age 25+"];
        const categoryData = categories.map(cat => {
            const found = data.find(d => d.age_group === cat);
            const count = found ? found.count : 0;
            console.log(`Category: ${cat}, Count: ${count}`);  // Debugging: Log the category and count
            return { age_group: cat, count: count };
        });

        // Hard code the maximum value for the y-axis
        const yMaxValue = 250;  // Set this to whatever maximum value you want for the y-axis

        /*
        const svg = d3.select(selector)
            .html("")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom) // Increase SVG height
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        const x = d3.scaleBand()
            .domain(categories)
            .range([0, width])
            .padding(0.1);

        // Use the global maximum for the y-axis domain
        const y = d3.scaleLinear()
            .domain([0, yMaxValue])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .selectAll("rect")
            .data(categoryData)
            .enter().append("rect")
            .attr("x", d => x(d.age_group))
            .attr("y", d => y(d.count))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.count))
            .attr("fill", "#BEFF00");
        */

        // Create the SVG with responsive properties
        const svg = d3.select(selector)
            .html("")
            .append("svg")
            .attr("viewBox", `0 0 ${600 + margin.left + margin.right} ${250 + margin.top + margin.bottom}`)  // Set the viewBox for scaling
            .attr("preserveAspectRatio", "xMidYMid meet")  // Maintain aspect ratio
            .style("width", "100%")  // Responsive width
            .style("height", "auto");  // Let height adjust automatically

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(categories)
            .range([0, 600])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, yMaxValue])
            .nice()
            .range([250, 0]);

        g.append("g")
            .selectAll("rect")
            .data(categoryData)
            .enter().append("rect")
            .attr("x", d => x(d.age_group))
            .attr("y", d => y(d.count))
            .attr("width", x.bandwidth())
            .attr("height", d => 250 - y(d.count))
            .attr("fill", "#BEFF00");

        // X-axis with labels only (no lines or ticks)
        const xAxis = svg.append("g")
            //.attr("transform", `translate(0, ${height}) + 20`)
            .attr("transform", `translate(${margin.left},${height + margin.top})`)  // Correctly position the x-axis group
            .call(d3.axisBottom(x)
                .tickSize(0))  // Remove tick marks
            .call(g => g.selectAll(".domain").remove())  // Remove axis line
            .call(g => g.selectAll("text")
                .attr("x", null))  // Directly center the label under the bar
                //.attr("dx", x.bandwidth() / 2)  // Center the label within the bar
                .attr("y", 10)  // Increase y to push labels further below the bars   
                .style("fill", "white")
                .style("font-size", "14px")
                .style("text-anchor", "middle"); // Center the labels below the bars
               
    }

    function createPieChart(data, selector, title) {
        /*
        const width = d3.select(selector).node().getBoundingClientRect().width; // Use the container's width
        const height = d3.select(selector).node().getBoundingClientRect().height; // Use the container's height
        */

        const container = d3.select(selector).node();
        const width = container.getBoundingClientRect().width;
        const height = container.getBoundingClientRect().height;
        const radius = Math.min(width, height) / 2 - 100; // Reduce radius to create space

        console.log("Container dimensions:", width, height); // Debugging output
        console.log("Calculated radius:", radius); // Debugging output

        console.log("Container dimensions:", width, height); // Debugging output

        // Ensure radius is positive
        if (radius <= 0) {
            console.error("Invalid radius:", radius); // Debugging output
            return; // Exit if radius is invalid
        }

        const svg = d3.select(selector)
            .html("")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            //.attr("transform", `translate(${radius + 20}, ${height / 2})`);
            .attr("transform", `translate(${width / 3}, ${height / 2})`); // Center the pie chart

        // Sort data by count in descending order
        const sortedData = data.sort((a, b) => b.count - a.count);

        const pie = d3.pie()
            .value(d => d.count);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const customColors = ["#beff00", "#0C79D5", "#513399", "#084B84", "#6AA84F", "#E27C00"];
        const colorScale = d3.scaleOrdinal()
            .domain(sortedData.map(d => d.ethnicity || d.gender || d.participant_industry))
            .range(customColors);  

        const arcs = svg.selectAll("arc")
            .data(pie(sortedData))
            .enter().append("g")
            .attr("class", "arc");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", d => colorScale(d.data.ethnicity || d.data.gender || d.data.participant_industry));

        console.log("Pie chart created successfully:", selector); // Debugging output

        // Move the title above the plot
        svg.append("text")
        .attr("x", 0)
        .attr("y", -radius - 20)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .style("fill", "white")
        .text(title);

        // Add legend to the outside right of the pie chart             
        const legend = svg.append("g")
            .attr("transform", `translate(${radius + 10}, ${-radius})`);  // Position the legend to the right of the chart

        legend.selectAll("rect")
            .data(sortedData)
            .enter().append("rect")
            .attr("x", 0)
            .attr("y", (d, i) => i * 20)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", d => colorScale(d.ethnicity || d.gender || d.participant_industry)) // Use the data to assign colors

        legend.selectAll("text")
            .data(sortedData)
            .enter().append("text")
            .attr("class", "legend-item")  // Add a class for legend items
            .attr("x", 18)
            .attr("y", (d, i) => i * 20 + 9)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .attr("font-size", "12px")
            .attr("fill", "white")
            .text(d => d.ethnicity || d.gender || d.participant_industry);
    }

    createChoroplethMap();
});
