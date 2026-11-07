import type { Block } from 'payload'

export const GoogleReviewsBlock: Block = {
  slug: 'googleReviews',
  labels: { singular: 'Google Reviews', plural: 'Google Reviews' },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      defaultValue: 'Our Reviews',
    },
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: 'What Our *Guests* Say on Google',
    },
  ],
}
