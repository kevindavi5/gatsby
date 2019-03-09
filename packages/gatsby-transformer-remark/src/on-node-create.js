const grayMatter = require(`gray-matter`)
const crypto = require(`crypto`)
const _ = require(`lodash`)
const yaml = require(`js-yaml`)

module.exports = async function onCreateNode(
  { node, loadNodeContent, actions, createNodeId, reporter },
  pluginOptions
) {
  const { createNode, createParentChildLink } = actions

  // We only care about markdown content.
  if (
    node.internal.mediaType !== `text/markdown` &&
    node.internal.mediaType !== `text/x-markdown`
  ) {
    return {}
  }

  const content = await loadNodeContent(node)

  try {
    let data = grayMatter(content, pluginOptions)

    if (data.data) {
      data.data = _.mapValues(data.data, value => {
        if (_.isDate(value)) {
          return value.toJSON()
        }
        return value
      })
    }

    const createMarkdownNode = data => {
      let markdownNode = {
        id: createNodeId(
          `${data.key ? node.id + data.key : node.id} >>> MarkdownRemark`
        ),
        children: [],
        parent: node.id,
        internal: {
          content: data.content,
          type: `MarkdownRemark`,
        },
      }

      markdownNode.frontmatter = {
        title: ``, // always include a title
        ...data.data,
      }

      markdownNode.excerpt = data.excerpt
      markdownNode.rawMarkdownBody = data.content

      // Add path to the markdown file path
      if (node.internal.type === `File`) {
        markdownNode.fileAbsolutePath = node.absolutePath
      }

      markdownNode.internal.contentDigest = crypto
        .createHash(`md5`)
        .update(JSON.stringify(markdownNode))
        .digest(`hex`)

      createNode(markdownNode)
      createParentChildLink({ parent: node, child: markdownNode })

      return markdownNode
    }

    const markdownNode = createMarkdownNode(data)

    if (data.sections && Object.keys(data.sections).length) {
      data.sections.map(section => {
        if (section.data) {
          section.data = yaml.safeLoad(section.data)
        }
        return section
      })

      data.sections.forEach(section => {
        createMarkdownNode(section)
      })
    }

    return markdownNode
  } catch (err) {
    reporter.panicOnBuild(
      `Error processing Markdown ${
        node.absolutePath ? `file ${node.absolutePath}` : `in node ${node.id}`
      }:\n
      ${err.message}`
    )

    return {} // eslint
  }
}
