// Minimal tree view previewing where Clario would organize renamed files.
function FolderTree({ tree }) {
  return (
    <div className="folder-tree">
      <p className="tree-root">🗂 {tree.name}</p>
      <ul>
        {tree.children.map((folder) => (
          <li key={folder.name}>
            <p className="tree-folder">📁 {folder.name}</p>
            <ul>
              {folder.children.map((file) => (
                <li key={file} className="tree-file">
                  📄 {file}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FolderTree
