const { Button, Icon, Spinner } = require('powercord/components');
const { SelectInput } = require('powercord/components/settings');
const { close: closeModal } = require('powercord/modal');
const { get } = require('powercord/http');
const { React, getModule } = require('powercord/webpack');
const { Modal } = require('powercord/components/modal');
const { decrypt } = require('../crypto');
const parser = getModule(['parse', 'parseTopic'], false);
const {
	shell: { openExternal },
} = require('electron');

const imageTypes = ['png', 'jpg'];
const folderIcon = 'https://raw.githubusercontent.com/Loremly/Assets/main/github%20icons/folder.svg';
const fileIcon = 'https://raw.githubusercontent.com/Loremly/Assets/main/github%20icons/file.svg';
const starIcon = 'https://raw.githubusercontent.com/Loremly/Assets/main/github%20icons/repo-stars.svg';
const forkIcon = 'https://raw.githubusercontent.com/Loremly/Assets/main/github%20icons/repo-forks.svg';

module.exports = class githubModel extends React.PureComponent {
	constructor() {
		super();
		this.state = {};
	}

	finishRequest(state, url) {
		const branches = get(`${url}/branches`);
		if (this.props.getSetting('api-key')) branches.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
		branches.then(res => (state.branches = res.body));

		const repo = get(`${url}/contents`);
		if (this.props.getSetting('api-key')) repo.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
		repo.then(res => {
			state.rootDir = res.body;
			setTimeout(() => this.setState(state), 100); // only 1 rerender
		});
	}

	componentDidMount() {
		const state = {};
		const defaultB = get(`https://api.github.com/repos/${this.props.link[3]}/${this.props.link[4]}`);
		if (this.props.getSetting('api-key')) defaultB.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
		defaultB.then(res => {
			if (res.body.message?.includes('Moved')) {
				const newURL = get(res.body.url);
				if (this.props.getSetting('api-key')) newURL.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
				return newURL.then(ress => {
					state.repoInfo = ress.body;
					state.selectedBranch = ress.body.default_branch;
					this.finishRequest(state, res.body.url);
				});
			}
			state.repoInfo = res.body;
			state.selectedBranch = res.body.default_branch;
			this.finishRequest(state, res.body.url);
		});
	}

	changeBranch(branch) {
		const repo = get(`${this.state.repoInfo.url}/contents/?ref=${branch}`);
		if (this.props.getSetting('api-key')) repo.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
		repo.then(res => this.setState({ rootDir: res.body, selectedBranch: branch, folder: null, file: null }));
	}

	viewFolder(folder) {
		const repo = get(`${this.state.repoInfo.url}/contents/${folder}?ref=${this.state.selectedBranch}`);
		if (this.props.getSetting('api-key')) repo.set('Authorization', `token ${decrypt(this.props.getSetting('api-key'))}`);
		repo.then(res => this.setState({ folder: res.body }));
	}

	openFile(fileName) {
		const file = this.state[this.state.folder ? 'folder' : 'rootDir'].filter(m => m.name === fileName);
		const type = fileName.split('.');
		if (file.length === 0) return;
		get(file[0].download_url).then(res => {
			let content;
			if (imageTypes.includes(type[type.length - 1])) content = new Buffer.from(res.body).toString('base64');
			else content = String(res.body);
			this.setState({ file: { path: file[0].path, content, type: type[type.length - 1], isImage: imageTypes.includes(type[type.length - 1]) } });
		});
	}

	goBack() {
		const dir = this.state.folder[0].path.split('/');
		if (dir.length === 2) return this.setState({ folder: null });
		this.viewFolder(this.state.folder[0].path.replace(`/${dir[dir.length - 2]}/${dir[dir.length - 1]}`, ''));
	}

	render() {
		let path;
		if (this.state.folder && !this.state.file) {
			const dir = this.state.folder[0]?.path.split('/');
			path = this.state.folder[0].path.replace(`/${dir[dir.length - 1]}`, '');
		} else if (this.state.file) path = this.state.file.path;
		return (
			<Modal className={['githubModel', this.state.file ? `infile ${powercord.pluginManager.get('vpc-shiki')?.ready ? 'has-vpc' : ''}` : '']}>
				<Modal.Header>
					<p className="repo-name" onClick={() => openExternal(this.state.repoInfo?.html_url)}>
						{this.state.repoInfo ? this.state.repoInfo.name : this.props.link[4]}
					</p>
					{this.state.repoInfo && (
						<div className="star-svg" onClick={() => openExternal(`${this.state.repoInfo.html_url}/stargazers`)}>
							<img src={starIcon} />
							<p>{this.state.repoInfo.stargazers_count}</p>
						</div>
					)}
					{this.state.file && (
						<div className="back-outfile">
							<Icon name={Icon.Names[57]} direction="LEFT" onClick={() => this.setState({ file: null })} />
						</div>
					)}
					{this.state.branches && (
						<SelectInput
							className="Gbranches"
							searchable={false}
							value={this.state.selectedBranch}
							onChange={change => this.changeBranch(change.value)}
							options={this.state.branches.map(branch => ({ label: branch.name, value: branch.name }))}
						/>
					)}
				</Modal.Header>
				<Modal.Content>
					{!this.state.repoInfo && <p className="Gfetching">
						Getting repo
						<Spinner type="wanderingCubes"/>
					</p>}
					{this.state.file && (
						<div>
							<div className="Gpath">
								<p>{`/${path}`}</p>
							</div>
							{this.state.file.isImage && (
								<div className="Gimg scrollbarGhostHairline-1mSOM1">
									<img src={`data:${this.state.file.type};base64,${this.state.file.content}`} />
								</div>
							)}
							{!this.state.file.isImage &&
								parser.defaultRules.codeBlock.react({ content: this.state.file.content, lang: this.state.file.type }, null, {})}
						</div>
					)}
					{this.state.folder && !this.state.file && (
						<div className="Gin-folder">
							<div className="Gpath">
								<p>{`/${path}/`}</p>
							</div>
							<div className="Gback-button">
								<img src={folderIcon} height={16} width={16} />
								<a onClick={() => this.goBack()}>Back</a>
							</div>
							{this.state.folder.map(tree => (
								<p
									className={[
										tree.type === 'dir' ? 'Gfolder' : 'Gfile',
										tree.type !== 'dir' ? tree.name.split('.')[tree.name.split('.').length - 1] : '',
										tree.type !== 'dir' ? (tree.name.includes('.') ? '' : 'blank') : '',
									]
										.join(' ')
										.trimEnd()}
								>
									{tree.type === 'dir'
										? [<img src={folderIcon} height={16} width={16} />, <a onClick={() => this.viewFolder(tree.path)}>{tree.name}</a>]
										: [<img src={fileIcon} height={16} width={16} />, <a onClick={() => this.openFile(tree.name)}>{tree.name}</a>]}
								</p>
							))}
						</div>
					)}
					{!this.state.folder && !this.state.file && this.state.rootDir && (
						<div className="Gout-folder">
							{this.state.rootDir?.map(tree => (
								<p
									className={[
										tree.type === 'dir' ? 'Gfolder' : 'Gfile',
										tree.type !== 'dir' ? tree.name.split('.')[tree.name.split('.').length - 1] : '',
										tree.type !== 'dir' ? (tree.name.includes('.') ? '' : 'blank') : '',
									]
										.join(' ')
										.trimEnd()}
								>
									{tree.type === 'dir'
										? [<img src={folderIcon} height={16} width={16} />, <a onClick={() => this.viewFolder(tree.path)}>{tree.name}</a>]
										: [<img src={fileIcon} height={16} width={16} />, <a onClick={() => this.openFile(tree.name)}>{tree.name}</a>]}
								</p>
							))}
						</div>
					)}
				</Modal.Content>
				<Modal.Footer>
					<Button
						style={{ paddingLeft: '5px', paddingRight: '10px' }}
						look={Button.Looks.LINK}
						color={Button.Colors.TRANSPARENT}
						onClick={closeModal}
					>
						Close
					</Button>
					{this.state.repoInfo && (
						<div className="repo-info">
							<div className="owner-profile" onClick={() => openExternal(this.state.repoInfo.owner.html_url)}>
								<img height={32} width={32} src={this.state.repoInfo.owner.avatar_url} />
								<p>{this.state.repoInfo.owner.login}</p>
							</div>
							<div className="fork-svg" onClick={() => openExternal(`${this.state.repoInfo.html_url}/network/members`)}>
								<img src={forkIcon} />
								<p>{this.state.repoInfo.forks}</p>
							</div>
						</div>
					)}
				</Modal.Footer>
			</Modal>
		);
	}
};
