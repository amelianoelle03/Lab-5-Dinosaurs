(() => {
	'use strict';

	// This is the user's Teachable Machine image classification model.
	const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/-_WxAGOoTV/';
	const FIST_THRESHOLD = 0.85;

	const elements = {
		scene: document.querySelector('#scene'),
		sceneState: document.querySelector('#scene-state'),
		sceneStateText: document.querySelector('#scene-state-text'),
		meteor: document.querySelector('#meteor'),
		impact: document.querySelector('#impact'),
		cameraFrame: document.querySelector('#camera-frame'),
		cameraPlaceholder: document.querySelector('#camera-placeholder'),
		webcamContainer: document.querySelector('#webcam-container'),
		cameraLiveLabel: document.querySelector('#camera-live-label'),
		startButton: document.querySelector('#start-camera'),
		resetButton: document.querySelector('#reset-scene'),
		predictionLabel: document.querySelector('#prediction-label'),
		predictionConfidence: document.querySelector('#prediction-confidence'),
		predictionNote: document.querySelector('#prediction-note'),
		predictionIcon: document.querySelector('#prediction-icon')
	};

	let model = null;
	let webcam = null;
	let isPredicting = false;
	let meteorStarted = false;
	let impactFinished = false;

	function setSceneState(message, stateClass = '') {
		elements.sceneStateText.textContent = message;
		elements.sceneState.classList.remove('is-alert', 'is-done');
		if (stateClass) elements.sceneState.classList.add(stateClass);
	}

	function setPrediction(label, confidence, note, icon) {
		elements.predictionLabel.textContent = label;
		elements.predictionConfidence.textContent = confidence === null
			? 'Confidence: —'
			: `Confidence: ${(confidence * 100).toFixed(1)}%`;
		elements.predictionNote.textContent = note;
		elements.predictionIcon.textContent = icon;
	}

	async function startCamera() {
		if (isPredicting) return;
		if (!window.tmImage || !navigator.mediaDevices?.getUserMedia) {
			setPrediction('Camera unavailable', null, 'Open this page on localhost or HTTPS, then check browser camera permissions.', '!');
			return;
		}

		elements.startButton.disabled = true;
		elements.startButton.textContent = 'Loading model…';
		setPrediction('Loading model…', null, 'Connecting to your Teachable Machine model and camera.', '…');

		try {
			// Teachable Machine loads the hosted model.json and metadata.json together.
			model = await window.tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);

			// The flip option mirrors the preview naturally, like a selfie camera.
			webcam = new window.tmImage.Webcam(320, 240, true);
			await webcam.setup();
			await webcam.play();
			elements.webcamContainer.replaceChildren(webcam.canvas);
			elements.webcamContainer.classList.add('is-active');
			elements.cameraFrame.classList.add('has-camera');
			elements.cameraLiveLabel.innerHTML = '<i></i> CAMERA LIVE';
			isPredicting = true;
			elements.startButton.textContent = 'Camera Running';
			setPrediction('Ready', null, 'Show a fist or an open hand to the camera.', '✓');
			requestAnimationFrame(predictLoop);
		} catch (error) {
			console.error('Could not start the Teachable Machine experiment:', error);
			const detail = error.name === 'NotAllowedError'
				? 'Allow camera access in your browser, then try again.'
				: 'Check your internet connection, model URL, and camera permissions, then try again.';
			setPrediction('Could not start', null, detail, '!');
			elements.startButton.disabled = false;
			elements.startButton.innerHTML = '<span class="button-camera">◉</span> Try Camera Again';
		}
	}

	async function predictLoop() {
		if (!isPredicting || !webcam || !model) return;
		webcam.update();

		try {
			// Each live webcam frame is classified locally by the trained image model.
			const predictions = await model.predict(webcam.canvas);
			const best = predictions.reduce((winner, current) =>
				current.probability > winner.probability ? current : winner
			);
			const label = best.className.trim();
			const normalizedLabel = label.toLowerCase();
			const isFist = normalizedLabel === 'fist';
			const isNoThreat = normalizedLabel === 'no threat';

			const note = isFist
				? (best.probability > FIST_THRESHOLD
					? (meteorStarted ? 'Fist detected! The meteor has already been launched.' : 'Fist detected! A meteor is on its way.')
					: 'Make a clear fist and hold it steady to trigger the meteor.')
				: isNoThreat
					? (impactFinished
						? 'No Threat detected. Press Reset to bring the dinosaurs back.'
						: meteorStarted
							? 'No Threat detected. A meteor is already on its way; Reset after impact to try again.'
							: 'No threat detected. The dinosaurs are safe and roaming.')
					: 'The model is watching for Fist or No Threat.';

			setPrediction(label, best.probability, note,
			isFist ? '✊' : isNoThreat ? '☀' : '◎');

			// Trigger only once per reset; a held fist cannot launch repeated meteors.
			if (isFist && best.probability > FIST_THRESHOLD && !meteorStarted && !impactFinished) {
				meteorStarted = true;
				void launchMeteor();
			}
		} catch (error) {
			console.error('Prediction failed:', error);
			setPrediction('Prediction paused', null, 'The webcam frame could not be classified. The next frame will retry.', '!');
		}

		if (isPredicting) requestAnimationFrame(predictLoop);
	}

	async function launchMeteor() {
		setSceneState('Meteor incoming!', 'is-alert');
		elements.meteor.classList.remove('is-falling');
		elements.impact.classList.remove('is-burst');
		// Let the browser apply the reset state before starting this new fall animation.
		await new Promise(resolve => requestAnimationFrame(resolve));
		elements.meteor.classList.add('is-falling');

		// The meteor starts 75px above the scene; this ends its core at the ground.
		const fallDistance = elements.scene.clientHeight - 30;
		const fall = elements.meteor.animate(
			[
				{ transform: 'translate(-50%, 0) rotate(42deg)' },
				{ transform: `translate(-50%, ${fallDistance}px) rotate(42deg)` }
			],
			{ duration: 1350, easing: 'cubic-bezier(.58,.02,.85,.58)', fill: 'forwards' }
		);

		try {
			await fall.finished;
		} catch {
			// Reset cancels the animation; it is not an experiment error.
			return;
		}

		elements.meteor.classList.remove('is-falling');
		elements.impact.classList.remove('is-burst');
		void elements.impact.offsetWidth;
		elements.impact.classList.add('is-burst');
		elements.scene.classList.add('is-impacted');
		impactFinished = true;
		setSceneState('The meteor has landed', 'is-done');
		setPrediction('Meteor impact!', null, 'The dinosaurs reacted to the simulated threat. Press Reset to try again.', '☄');
	}

	function resetScene() {
		// Stop any in-flight animation before making a fresh run possible.
		elements.meteor.getAnimations().forEach(animation => animation.cancel());
		elements.meteor.classList.remove('is-falling');
		elements.impact.classList.remove('is-burst');
		elements.scene.classList.remove('is-impacted');
		meteorStarted = false;
		impactFinished = false;
		setSceneState('Dinos are roaming');
		if (isPredicting) {
			setPrediction('Ready', null, 'Show a fist or an open hand to the camera.', '✓');
		} else {
			setPrediction('Waiting to start', null, 'Start the camera to see what the model detects.', '?');
		}
	}

	elements.startButton.addEventListener('click', startCamera);
	elements.resetButton.addEventListener('click', resetScene);
})();
