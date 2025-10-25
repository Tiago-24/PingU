# Terraform google cloud multi tier deployment

# check how configure the provider here:
# https://www.terraform.io/docs/providers/google/index.html
provider "google" {
    credentials = file("agisit25-g33-1b9e4368baa2.json")
    project = var.GCP_PROJECT_ID
    zone = var.GCP_ZONE
}
