// this is a nice solution! :D 
const orders = {
    "age_group": ["Age 4-9", "Age 10-12", "Age 13-15", "Age 16-19", "Age 20-24", "Age 25+", "Unknown"],
    "location": ["St. Albans", "Bath", "Cambridge", "Chelmsford", "Colchester", "Ipswich", "Milton Keynes", "London", "Norwich", "Peterborough", "Romford", "Stevenage"],
    "ethnicity": ["Asian", "Black", "White", "Mixed", "Declined to say", "Unknown"],
    "gender": ["Female", "Male", "Other", "Unknown"]
};

d3.csv("data.csv").then(function (data) {
    console.log("Loaded Data:", data);

    // Define a mutable holding place for filtered data indices
    let filteredData = [];

    const margin = { top: 50, right: 10, bottom: 10, left: 10 },
        svgWidth = 800,
        svgHeight = 500,
        width = svgWidth - margin.left - margin.right,
        height = svgHeight - margin.top - margin.bottom;

    const svg = d3.select("#beeswarm-chart-container svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Adjust the translation to center the `g` element
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);      

    // these things are data dependent, but not dynamic 
    // once you have data you can set it and forget it
    // again, responsiveness would necessitate making these dynamic
    const xScale = d3.scalePoint()
        .domain(orders.age_group)
        .range([0, width])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => +d.score_change), d3.max(data, d => +d.score_change)])
        .nice()
        .range([height, 0]);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("class", "axis")
        .call(d3.axisBottom(xScale));

    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    // Append a dotted line at y = 0
    g.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", yScale(0))
    .attr("y2", yScale(0))
    .attr("stroke", "#beff00")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4"); // Creates the dotted effect

    const simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(d => xScale(d.age_group)).strength(0.1))
        .force("y", d3.forceY(d => yScale(+d.score_change)).strength(0.8))
        .force("collide", d3.forceCollide(5))
        .stop();

    for (let i = 0; i < 300; i++) simulation.tick();

    plotBeeswarm(data);

    // Log the bounding box dimensions
    const bbox = g.node().getBBox();
    console.log("Bounding Box of g:", bbox);

    // Adjust the transformation if needed
    const xOffset = (svgWidth - bbox.width) / 2;
    const yOffset = (svgHeight - bbox.height) / 2;
    
    g.attr("transform", `translate(${xOffset - bbox.x},${yOffset - bbox.y})`);

    // since you are performing the same function with the same input
    // regardless of which dropdown is selected you don't need to apply 
    // the event listener individually. 
    d3.selectAll(".dropdown").on("change", () => cascadeDropdowns(data));

    d3.select("#clear-button").on("click", function () {
        filteredData = [];
        clearSelections(data);
    });

    cascadeDropdowns(data);

    function cascadeDropdowns(data) {

        const selectedAgeGroup = d3.select("#age-group").property("value");
        const selectedLocation = d3.select("#location").property("value");
        const selectedEthnicity = d3.select("#ethnicity").property("value");
        const selectedGender = d3.select("#gender").property("value");

        // use slice to make a copy of the data here so you don't unintentionally 
        // mutate your original data, since you'll still need the original dataset
        // to replot the beeswarm on every filter change
        let currentData = data.slice();

        if (selectedAgeGroup) {
            currentData = currentData.filter(d => d.age_group === selectedAgeGroup);
        }

        if (selectedLocation) {
            currentData = currentData.filter(d => d.location === selectedLocation);
        }

        if (selectedEthnicity) {
            currentData = currentData.filter(d => d.ethnicity === selectedEthnicity);
        }

        if (selectedGender) {
            currentData = currentData.filter(d => d.gender === selectedGender);
        }

        // apply all filters to the dataset first, then populate the dropdowns 
        // so the choices in the dropdowns reflect what's currently available. 
        // this means that some choice combos might remove all the options
        // so this is an opportunity to think through the UX and what someone
        // might need or expect to help them through that scenario
        const locations = [...new Set(currentData.map(d => d.location))]
            .sort((a, b) => orders.location.indexOf(a) - orders.location.indexOf(b));
        updateDropdown("#location", locations, selectedLocation);

        const ethnicities = [...new Set(currentData.map(d => d.ethnicity))]
            .sort((a, b) => orders.ethnicity.indexOf(a) - orders.ethnicity.indexOf(b));
        updateDropdown("#ethnicity", ethnicities, selectedEthnicity);

        const genders = [...new Set(currentData.map(d => d.gender))]
            .sort((a, b) => orders.gender.indexOf(a) - orders.gender.indexOf(b));
        updateDropdown("#gender", genders, selectedGender);

        const ages = [...new Set(currentData.map(d => d.age_group))]
            .sort((a, b) => orders.age_group.indexOf(a) - orders.age_group.indexOf(b));
        updateDropdown("#age-group", ages, selectedAgeGroup);

        // only populate the global filtered data variable if some filters have been applied
        // this keeps all the highlights off when all the dropdowns are cleared
        if (currentData.length < data.length) {
            filteredData = currentData.map(d => d.index);
        } else {
            filteredData = [];
        }
        console.log("current data", currentData);
        console.log("filtered data", filteredData);
        updateAverageScore(currentData);
        plotBeeswarm(data);
    }

    // excellent implementation! :D 
    function updateDropdown(selector, options, selectedValue) {
        const dropdown = d3.select(selector);
        dropdown.selectAll("option").remove();

        dropdown.append("option").attr("value", "").text("Select...");

        dropdown.selectAll("option.option-item")
            .data(options)
            .enter()
            .append("option")
            .classed("option-item", true)
            .text(d => d)
            .attr("value", d => d);

        if (selectedValue && options.includes(selectedValue)) {
            dropdown.property("value", selectedValue);
        } else {
            dropdown.property("value", "");
        }
    }

    // this function is now called from inside the cascadeDropdowns function
    // and receives the filtered dataset to calculate the average
    // meaning it will update on every change in any dropdown giving you 
    // the average for any combination of selected filters
    // and eliminating the need to do the costly filtering process again
    function updateAverageScore(data) {

        const avgScoreChange = d3.mean(data, d => d.score_change);
        console.log(avgScoreChange);

        // if the avgScoreChange is 0 you still want to display it
        // `if (avgScoreChange)` resolves to false if the value is 0
        if (typeof avgScoreChange === "number") {
            d3.select("#avg-score").text(avgScoreChange.toFixed(2));
            d3.select("#result").style("display", "block");
        } else {
            d3.select("#avg-score").text("No data");
        }
    }

    function clearSelections(data) {
        d3.select("#age-group").property("value", "");
        d3.select("#location").property("value", "");
        d3.select("#ethnicity").property("value", "");
        d3.select("#gender").property("value", "");

        // repopulate the dropdowns with all the options
        cascadeDropdowns(data);

        // replotting the dots will have the addon effect of removing the highlight
        plotBeeswarm(data);

        // updating the average score here will return it to 
        // the overall average for the entire dataset
        updateAverageScore(data);
    }

    function plotBeeswarm(data) {
        // the plot function can use the d3 join method to update the dots every time
        // the dropdowns change, and use the global variable filteredData to conditionally
        // apply the highlighted stroke
        g.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 5)
            .attr("fill", "#513399")
            .attr("opacity", 0.7)
            .attr("stroke", d => filteredData.includes(d.index) ? "#beff00" : null)
            .attr("stroke-width", d => filteredData.includes(d.index) ? 1 : 0)
            .append("title")
            // the hover text should display everything about the data point, except the age group
            // which is pretty evident based on the categorical layout of the x axis
            .text(d => `Location: ${d.location}\nEthnicity: ${d.ethnicity}\nGender: ${d.gender}\nScore Change: ${d.score_change}`);
    }
});