options(scipen = 999)             # Modify global options in R

# Install Packages, Load Libraries ----
packages_required <- c("tidyverse",   ## List of required packages
                       "readxl", 
                       "Microsoft365R",
                       "glue", 
                       "ggtext", 
                       "devtools",
                       "treemap",
                       "treemapify",
                       "knitr",
                       "zoo",
                       "lubridate",
                       "data.table",
                       "vroom",
                       "readr",
                       "stringr",
                       "janitor", # rename columns to snake case
                       "corrplot", # build correlation visualization
                       "sf",
                       "lwgeom") # GeoJSON

new_packages <- packages_required[!(packages_required %in% installed.packages()[,"Package"])] ## List of packages to be installed

if(length(new_packages)) install.packages(new_packages) ## Install packages if necessary

lapply(packages_required, library, character.only = TRUE) ## Load libraries if necessary

# Set Directory, Clear Console and Environment ----
rm(list = ls()) # Clear environment

cat("\014") # Clear console

setwd("/Users/georgenafalzon/Documents/DATASETS/Noise Solution")

# LOAD DATA ----

data <- read_xls("VFSG Noise Solution Report Aug 24.xls") # Noise Solution raw data
postcodes_latlongs <- read_xlsx("postcodes_latlongs.xlsx") # postcodes' lat longs generated online
postcode_areas_regions <- read_xlsx("postcode_areas_regions.xlsx") # load data table with the alpha portion of the postal outcodes and the area & region associated with each

# DATA WRANGLE ----

# convert column names to snake case
data <- clean_names(data)

postcodes_latlongs <- clean_names(postcodes_latlongs)

valid_outcode_pattern <- "^[A-Z]{1,2}[0-9]{1,2}[A-Z]?$" # Define a pattern for valid UK outcodes (get rid of any rows with non-conforming values)

data$postcode <- gsub("1P23", "IP23", data$postcode) # Replace "1P23" with "IP23"

data$score_change <- data$swemwbs_end_score - data$swemwbs_start_score # NEW COLUMN score_change

# Get lat longs for outward postal codes 

unique_postcodes <- unique(data$postcode) # extract unique outward codes from data frame, and write to file
print(unique_postcodes)
write(unique_postcodes, "unique_postcodes.csv")

data_with_latlongs <- merge(data, postcodes_latlongs, by = "postcode", all.x = TRUE) # merge the two data frames based on the 'postcode' column

data_with_latlongs_clean <- data_with_latlongs[grepl(valid_outcode_pattern, data_with_latlongs$postcode), ] # filter rows with valid outcodes

# NEW COLUMNS 
data_with_latlongs_clean <- data_with_latlongs_clean %>% # separate postcode into outcode_alpha and outcode_numeric
  mutate(
    outcode_alpha = gsub("[^A-Za-z]", "", postcode), # Extract the alphabetic part
    outcode_numeric = gsub("[^0-9]", "", postcode)   # Extract the numeric part
  )

# NEW COLUMN 
data_with_latlongs_clean <- data_with_latlongs_clean %>%  # ethnicity_clean, based on below criteria
  mutate(ethnicity_clean = case_when(
    ethnicity %in% c("English/Welsh/Scottish/Northern Irish/British Irish",
                "White or White British", 
                "White ? British/English/Scottish/Welsh/Northern Irish",
                "White ? any other white background") ~ "White",
    ethnicity %in% c("Black or Black British", 
                "Black/African/Caribbean/Black British ? African") ~ "Black",
    ethnicity %in% c("Mixed/multiple ethnic groups ? White and Black African background", 
                "White and Black Caribbean", 
                "Mixed") ~ "Mixed",
    ethnicity %in% c("Any", "Other", "Not yet available", NA) ~ "Unknown",
    ethnicity %in% c("Decline to say", "Prefer not to say") ~ "Declined to say",
    ethnicity %in% c("Asian", "Bangladesh") ~ "Asian"
  ))

# NEW COLUMN
data_with_latlongs_clean <- data_with_latlongs_clean %>% # gender_clean
  mutate(gender_clean = case_when(
    gender %in% c("Female") ~ "Female",
    gender %in% c("Male") ~ "Male",
    gender %in% c("Other", 
                     "Non-binary") ~ "Other",
    gender = is.na(gender) ~ "Unknown",
    gender %in% c("Decline to say", "Prefer not to say") ~ "Declined to say"
  ))

data_with_latlongs_clean <- data_with_latlongs_clean %>% # Replace NA with "Unknown" in participant_industry column
  mutate(participant_industry = ifelse(is.na(participant_industry), "Unknown", participant_industry)) 

# merge to add columns for postcode area and region
postcode_areas_regions <- clean_names(postcode_areas_regions) %>% # rename the postcode_area column to outcode_alpha, to match with data 
  rename(outcode_alpha = postcode_area) 

data_with_latlongs_areas_regions <- merge(data_with_latlongs_clean, postcode_areas_regions, by = "outcode_alpha", all.x = TRUE) # add columns for area and region names, corresponding with outcodes

# fix the date column data (convert from POSIXct format to Date format)
data_with_latlongs_areas_regions$impact_created_date <- as.Date(data_with_latlongs_areas_regions$impact_created_date)

# NEW COLUMN
data_with_latlongs_areas_regions <- data_with_latlongs_areas_regions %>% # create age_group column
  mutate(age_group = case_when(
    swemwbs_start_age >= 4 & swemwbs_start_age <= 9  ~ "Age 4-9",
    swemwbs_start_age >= 10 & swemwbs_start_age <= 12 ~ "Age 10-12",
    swemwbs_start_age >= 13 & swemwbs_start_age <= 15 ~ "Age 13-15",
    swemwbs_start_age >= 16 & swemwbs_start_age <= 19 ~ "Age 16-19",
    swemwbs_start_age >= 20 & swemwbs_start_age <= 24 ~ "Age 20-24",
    swemwbs_start_age >= 25 ~ "Age 25+",
    swemwbs_start_age = is.na(swemwbs_start_age) ~ "Unknown"
  ))

# NEW COLUMN
data_with_latlongs_areas_regions <- data_with_latlongs_areas_regions %>% # has_external_interactions
  mutate(has_external_interaction = case_when(
    external_members > 0 ~ "Yes",
    external_members == 0 ~ "No"
  ))

# NEW COLUMN
data_with_latlongs_areas_regions <- data_with_latlongs_areas_regions %>% # change_reported
  mutate(change_reported = case_when(
    score_change > 0 ~ "Positive",
    score_change == 0 ~ "No change",
    score_change < 0 ~ "Negative"
  ))

# NEW COLUMN
data_with_latlongs_areas_regions <- data_with_latlongs_areas_regions %>% # size_of_change
  mutate(size_of_change = abs(score_change))



data_for_d3 <- data_with_latlongs_areas_regions %>% # prep data frame for use in D3
  select(uin,
         account_unique_id,
         postcode,
         outcode_alpha,
         postcode_area_name,
         region,
         swemwbs_start_age,
         age_group,
         gender_clean,
         ethnicity_clean,
         participant_industry,
         has_external_interaction,
         change_reported,
         size_of_change,
         external_members,
         posts,
         comments,
         likes,
         swemwbs_start_score,
         swemwbs_end_score,
         score_change,
         latitude,
         longitude) %>%
  rename(area = postcode_area_name,
         start_age = swemwbs_start_age,
         gender = gender_clean,
         ethnicity = ethnicity_clean)

write_csv(data_for_d3, "data_for_d3.csv")
  
# DESCRIPTIVE STATS for each factor  (gender_clean, ethnicity_clean, participant_industry) ----

# average score change by postcode
data_summary_by_postcode <- data_with_latlongs_areas_regions %>%
  group_by(postcode, latitude, longitude, postcode_area_name, region) %>%
  summarize(average_score_change = mean(score_change),
            count = n())

write_csv(data_summary_by_postcode, "data_summary_by_postcode.csv")

# average score change by region
data_summary_by_region <- data_with_latlongs_areas_regions %>%
  group_by(outcode_alpha) %>%
  summarize(average_score_change = mean(score_change),
            count = n())

write_csv(data_summary_by_region, "data_summary_by_region.csv")

# average score change by gender
data_summary_by_gender <- data_with_latlongs_areas_regions %>%
  group_by(gender_clean) %>%
  summarize(average_score_change = mean(score_change),
            count = n())

write_csv(data_summary_by_gender, "data_summary_by_gender.csv")

# average score change by ethnicity
data_summary_by_ethnicity <- data_with_latlongs_areas_regions %>%
  group_by(ethnicity_clean) %>%
  summarize(average_score_change = mean(score_change),
            count = n())

write_csv(data_summary_by_ethnicity, "data_summary_by_ethnicity.csv")

# average score change by participant industry
data_summary_by_participant_industry <- data_with_latlongs_areas_regions %>%
  group_by(participant_industry) %>%
  summarize(average_score_change = mean(score_change),
            count = n())

write_csv(data_summary_by_participant_industry, "data_summary_by_participant_industry.csv")

# descriptive stats
data_summary_all_factors <- data_with_latlongs_areas_regions %>%
  group_by(gender_clean, ethnicity_clean, participant_industry) %>%
  summarize(average_score_change = mean(score_change),
            sd_score_change = sd(score_change)) 

# VISUALIZATION: boxplots for each factor (gender_clean, ethnicity_clean, participant_industry) ----
ggplot(data_with_latlongs_areas_regions, aes(x = ethnicity_clean, y = score_change)) + 
  geom_boxplot() + 
  labs(title = "Score Change by Ethnicity") + 
  theme_minimal()

ggplot(data_with_latlongs_areas_regions, aes(x = participant_industry, y = score_change)) + 
  geom_boxplot() + 
  labs(title = "Score Change by Participating Industry") + 
  theme_minimal()

ggplot(data_with_latlongs_areas_regions, aes(x = gender_clean, y = score_change)) + 
  geom_boxplot() + 
  labs(title = "Score Change by Gender") + 
  theme_minimal()

# ANOVA or each factor (gender_clean, ethnicity_clean, participant_industry) ----
anova_ethnicity <- aov(score_change ~ ethnicity_clean, data = data_with_latlongs_areas_regions)
anova_industry <- aov(score_change ~ participant_industry, data = data_with_latlongs_areas_regions)
anova_gender <- aov(score_change ~ gender_clean, data = data_with_latlongs_areas_regions)

summary(anova_ethnicity)
summary(anova_industry)
summary(anova_gender)

# post-hoc for gender
tukey_gender <- TukeyHSD(anova_gender)

plot(tukey_gender)

# subset for rows with external member comments/likes/posts interactions

data_story_interactions <- data %>%
  filter(external_members != 0)

# AGE VIZ ----

# violin plot with boxplot
ggplot(data_with_latlongs_areas_regions, aes(x = "", y = swemwbs_start_age)) + 
  geom_violin(fill = "lightblue") + 
  geom_boxplot(width = 0.1, fill = "white") + 
  labs(title = "Violin Plot of Age", y = "Age")

# histogram with density plot
ggplot(data_with_latlongs_areas_regions, aes(x = swemwbs_start_age)) +
  geom_histogram(aes(y = ..density..), bins = 15, fill = "skyblue", color = "white") +
  geom_density(color = "red", size = 1) +
  labs(title = "Age Distribution with Density Plot", x = "Age", y = "Density")

# average score change by age group
data_summary_by_age_group <- data_with_latlongs_areas_regions %>%
  group_by(age_group) %>%
  summarize(average_score_change = mean(score_change),
            count = n())


# QUESTION: Do increasing SWEMWBS scores correlate with number of LIKES? (NO) ----

# Perform correlation analysis
correlation_likes <- cor(data_story_interactions$likes, data_story_interactions$score_change)
print(paste("Correlation between likes and score change:", correlation))

# visualize the relationship
plot(data_story_interactions$likes, data_story_interactions$score_change, 
     main = "Scatter Plot of Likes vs Score Change",
     xlab = "Number of Likes",
     ylab = "Score Change",
     pch = 19, col = "blue")

# Perform linear regression (optional)
model <- lm(score_change ~ likes, data = data_story_interactions)
summary(model)

# QUESTION: Do increasing SWEMWBS scores correlate with number of COMMENTS? (NO) ----

# Perform correlation analysis
correlation_comments <- cor(data_story_interactions$comments, data_story_interactions$score_change)
print(paste("Correlation between comments and score change:", correlation))

# Visualize the relationship
plot(data_story_interactions$comments, data_story_interactions$score_change, 
     main = "Scatter Plot of Comments vs Score Change",
     xlab = "Number of Comments",
     ylab = "Score Change",
     pch = 19, col = "blue")

# QUESTION: Do increasing SWEMWBS scores correlate with number of POSTS? (barely) ----

# Perform correlation analysis
correlation_posts <- cor(data_story_interactions$posts, data_story_interactions$score_change)
print(paste("Correlation between posts and score change:", correlation))

# Visualize the relationship
plot(data_story_interactions$posts, data_story_interactions$score_change, 
     main = "Scatter Plot of Posts vs Score Change",
     xlab = "Number of Posts",
     ylab = "Score Change",
     pch = 19, col = "blue")


# QUESTION: Do increasing SWEMWBS scores correlate with number of EXTERNAL MEMBERS？(NO) ----

# Perform correlation analysis
correlation_externalmembers <- cor(data_story_interactions$swemwbs_start_age, data_story_interactions$score_change)

print(paste("Correlation between # of external members and score change:", correlation))

# Visualize the relationship
plot(data_story_interactions$external_members, data_story_interactions$score_change, 
     main = "Scatter Plot of # of External Members vs Score Change",
     xlab = "Number of External Members",
     ylab = "Score Change",
     pch = 19, col = "blue")


# QUESTION: Do increasing SWEMWBS scores correlate with number of AGE？(NO)----

# Perform correlation analysis
correlation_age<- cor(data_story_interactions$posts, data_story_interactions$swemwbs_start_age)

print(paste("Correlation between age and score change:", correlation))

# Visualize the relationship
plot(data_story_interactions$swemwbs_start_age, data_story_interactions$score_change, 
     main = "Scatter Plot of Posts vs Score Change",
     xlab = "Start Age",
     ylab = "Score Change",
     pch = 19, col = "blue")

# QUESTION: Is there any correlation between score change and other quantitative variables? (NO) ----

# calculate correlation matrix

# Specify the columns you want to include
columns_of_interest <- c("score_change", "swemwbs_start_age", "comments", "likes", "posts", "external_members")

# Subset the data to include only these columns
data_subset <- data[, columns_of_interest]

# Ensure the columns are numeric
data_subset <- data_subset[, sapply(data_subset, is.numeric)]

# Calculate the correlation matrix for the selected columns
cor_matrix <- cor(data_subset, use = "complete.obs")

# Extract the correlation values for 'score_change'
score_change_corr <- cor_matrix['score_change',]

# Print the correlation values
print(score_change_corr)

# Plot the correlation matrix
corrplot(cor_matrix, method = "circle", type = "lower")

# Multiple Regression Model ----

# Fit the model
model <- lm(score_change ~ swemwbs_start_age + comments + likes + posts + external_members, data)


# GeoJSON ----

install.packages("sf", dependencies = FALSE)


# Set the directory containing your GeoJSON files
geojson_dir <- "/Users/georgenafalzon/Documents/DATASETS/Noise Solution/geojson"

# List all GeoJSON files in the directory
geojson_files <- list.files(geojson_dir, pattern = "\\.geojson$", full.names = TRUE)

# Function to read GeoJSON files and align columns
read_and_align <- function(file) {
  gdf <- st_read(file, quiet = TRUE)
  
  # List the columns that should be present
  all_columns <- c("area", "mapit_code")  # Add more columns as needed
  
  # Add missing columns with NA values
  for (col in all_columns) {
    if (!col %in% colnames(gdf)) {
      gdf[[col]] <- NA
    }
  }
  
  # Ensure consistent column order
  gdf <- gdf[, all_columns, drop = FALSE]
  
  return(gdf)
}

# Read and combine all GeoJSON files into a single sf object
combined_geojson <- do.call(rbind, lapply(geojson_files, read_and_align)) %>%
  rename(outcode_alpha = area)

combined_geojson <- st_make_valid(combined_geojson)



# Write to file
st_write(combined_geojson, "uk_outcode_regions.geojson", driver = "GeoJSON", delete_dsn = TRUE)

names(combined_geojson)




  






