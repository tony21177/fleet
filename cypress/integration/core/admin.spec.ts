describe("Core tier - Admin user", () => {
  beforeEach(() => {
    cy.setup();
    cy.login();
    cy.setupSMTP();
    cy.seedCore();
    cy.seedQueries();
    cy.addDockerHost();
    cy.logout();
  });
  afterEach(() => {
    cy.stopDockerHost();
  });

  it("Can perform the appropriate core-tier admin actions", () => {
    cy.login("anna@organization.com", "user123#");
    cy.visit("/");

    // Ensure page is loaded
    cy.contains("All hosts");

    // On the hosts page, they should…

    // Not see "team" anywhere on the page
    cy.contains(/team/i).should("not.exist");

    // See all navigation items
    cy.get("nav").within(() => {
      cy.findByText(/hosts/i).should("exist");
      cy.findByText(/queries/i).should("exist");
      cy.findByText(/schedule/i).should("exist");
      cy.findByText(/settings/i).should("exist");
    });

    // See and select "add new host"
    cy.findByRole("button", { name: /new host/i }).click();
    cy.contains(/team/i).should("not.exist");
    cy.findByRole("button", { name: /done/i }).click();

    // See and select "add new label"
    cy.findByRole("button", { name: /new label/i }).click();
    cy.findByRole("button", { name: /cancel/i }).click();

    // On the Host details page, they should…
    cy.visit("/hosts/1");

    // Not see "team" information or transfer button
    cy.findByText(/team/i).should("not.exist");
    cy.contains("button", /transfer/i).should("not.exist");

    // See and select the “Delete” button
    cy.findByRole("button", { name: /delete/i }).click();
    cy.findByText(/delete host/i).should("exist");
    cy.findByRole("button", { name: /cancel/i }).click();

    // See and select the “Query” button
    cy.findByRole("button", { name: /query/i }).click();
    cy.findByRole("button", { name: /create custom query/i }).should("exist");
    cy.get(".modal__ex").within(() => {
      cy.findByRole("button").click();
    });

    // On the queries manage page, they should…
    cy.contains("a", "Queries").click();
    // See the "observers can run column"
    cy.contains(/observers can run/i);
    // See and select the "create new query" button
    cy.findByRole("button", { name: /new query/i }).click();

    // On the Queries - new/edit/run page, they should…
    // Edit the “Query name,” “SQL,” “Description,” “Observers can run,” and “Select targets” input fields.
    cy.findByLabelText(/query name/i)
      .click()
      .type("time");
    // ACE editor requires special handling to get typing to work sometimes
    cy.get(".ace_text-input")
      .first()
      .click({ force: true })
      .type("{selectall}{backspace}SELECT * FROM time;", { force: true });
    cy.findByLabelText(/description/i)
      .click()
      .type("Get the time.");
    cy.findByLabelText(/observers can run/i).click({ force: true });

    // See and select the “Save changes,” “Save as new,” and “Run” buttons.
    cy.findByRole("button", { name: /save/i }).click();
    cy.findByRole("button", { name: /new/i }).click();
    cy.findByRole("button", { name: /run/i }).should("exist");

    // NOT see the “Teams” section in the Select target picker. This picker is summoned when the “Select targets” field is selected.
    cy.get(".target-select").within(() => {
      cy.findByText(/Label name, host name, IP address, etc./i).click();
      cy.findByText(/teams/i).should("not.exist");
    });

    // See and select the “Edit or run query” button in the right side panel. This button appears after the user selects a query in the Queries table
    cy.contains("a", /back to queries/i).click({ force: true });
    cy.findByText(/get the time/i).click();
    cy.findByRole("button", { name: /edit or run query/i }).should("exist");

    // On the Packs pages (manage, new, and edit), they should…
    // ^^General admin functionality for packs page is being tested in app/packflow.spec.ts

    // On the Settings pages, they should…
    // See everything except for the “Teams” pages
    cy.visit("/settings/organization");
    cy.findByText(/teams/i).should("not.exist");
    cy.get(".react-tabs").within(() => {
      cy.findByText(/organization settings/i).should("exist");
      cy.findByText(/users/i).click();
    });
    cy.findByRole("button", { name: /create user/i }).click();
    cy.findByText(/team/i).should("not.exist");
    cy.visit("/settings/teams");
    cy.findByText(/you do not have permissions/i).should("exist");
  });
});
