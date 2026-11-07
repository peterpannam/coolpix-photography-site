import {defineArrayMember, defineField, defineType} from 'sanity'
import {PinIcon} from '@sanity/icons/Pin'

export const place = defineType({
  name: 'place',
  type: 'document',
  icon: PinIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      description: 'Must be unique: the map builds each place’s ID from its name.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'location',
      type: 'geopoint',
      description:
        'Where the photographs were taken. The map finds the region and distance from the nearest point on the route.',
      validation: (rule) =>
        rule.required().custom((point) => {
          if (!point) return true
          const inAustralia =
            point.lat >= -44 && point.lat <= -9 && point.lng >= 112 && point.lng <= 155
          return inAustralia || 'This point is outside Australia. Check the latitude and longitude.'
        }),
    }),
    defineField({
      name: 'story',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alternative Text',
              type: 'string',
              description: 'Describe the photograph for people who can’t see it.',
              validation: (rule) => rule.required(),
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'print',
      title: 'Available as a print',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'printHref',
      title: 'Print link',
      type: 'url',
      hidden: ({parent}) => !parent?.print,
      validation: (rule) => rule.uri({allowRelative: true, scheme: ['http', 'https']}),
    }),
    defineField({
      name: 'storyHref',
      title: 'Full story link',
      type: 'url',
      validation: (rule) => rule.uri({allowRelative: true, scheme: ['http', 'https']}),
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'story', media: 'images.0'},
  },
})
