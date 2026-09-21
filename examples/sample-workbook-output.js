// A workbook definition shaped exactly as the Builder would produce it.
// Used by the Runtime-only examples/tests (no Builder involved here).
export const sampleWorkbook = {
  id: "customer-analysis",
  title: "Customer Analysis Workbook",
  worksheets: [
    {
      id: "worksheet-1",
      title: "Understanding the Customer",
      sections: [
        {
          id: "basic-information",
          title: "Basic Information",
          columns: 2,
          collapsible: false,
          fields: [
            { id: "customer_name", type: "short-text", label: "Customer name", required: true, column: 0 },
            { id: "review_date", type: "date", label: "Review date", column: 0 },
            {
              id: "customer_type",
              type: "dropdown",
              label: "Customer type",
              options: ["Individual", "Small business", "Enterprise", "Government"],
              column: 1,
            },
            {
              id: "priority",
              type: "radio",
              label: "How important is this customer?",
              options: ["Low", "Medium", "High"],
              column: 1,
            },
          ],
        },
        {
          id: "customer-needs",
          title: "Customer Needs",
          columns: 1,
          collapsible: true,
          startCollapsed: false,
          fields: [
            {
              id: "needs-illustration",
              type: "image",
              src: "https://picsum.photos/seed/customer/400/240",
              alt: "Illustration of customer needs",
              caption: "Think broadly about what this customer values.",
            },
            {
              id: "needs",
              type: "checkbox-group",
              label: "What does the customer need?",
              options: ["Speed", "Lower cost", "Better quality", "Support"],
            },
            {
              id: "customer_description",
              type: "long-text",
              label: "Describe the customer.",
            },
          ],
        },
      ],
    },
    {
      id: "worksheet-2",
      title: "Reflection",
      sections: [
        {
          id: "reflection-section",
          title: "Your Reflection",
          columns: 1,
          fields: [
            { id: "reflection", type: "long-text", label: "What did you learn?", required: true },
            { id: "student_signature", type: "signature", label: "Signature", required: true },
          ],
        },
      ],
    },
  ],
};
