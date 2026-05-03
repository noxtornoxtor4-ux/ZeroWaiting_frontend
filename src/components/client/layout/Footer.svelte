<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Icon from '@iconify/svelte';

	const startYear = 2026;
	const currentYear = new Date().getFullYear();
	const yearLabel =
		currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;

	let email = $state('');

	const handleNewsletterSubmit = () => {
		if (email.trim()) {
			email = '';
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			handleNewsletterSubmit();
		}
	};

	const socialLinks = [
		{ name: 'Telegram', icon: 'lucide:message-circle', url: '/' },
		{ name: 'VK', icon: 'lucide:users', url: '/' },
		{ name: 'YouTube', icon: 'lucide:youtube', url: '/' },
		{ name: 'Instagram', icon: 'lucide:instagram', url: '/' }
	];
</script>

<footer class="Footer">
	<div class="container">
		<div class="content">
			<div class="footer_section footer_section--main">
				<a href="/" class="logo">
					<div class="logo_icon">
						<Icon icon="lucide:film" width={24} />
					</div>
					<span class="logo_text">ZeroWaiting</span>
				</a>
				<p class="footer_description">
					{$_('home.heroSubtitle')}
				</p>
				<div class="social_links">
					{#each socialLinks as social (social.name)}
						<a href={social.url} title={social.name} class="social_link">
							<Icon icon={social.icon} width={18} />
						</a>
					{/each}
				</div>
			</div>

			<div class="footer_section">
				<h3 class="section_title">{$_('nav.home')}</h3>
				<ul class="footer_links">
					<li><a href="/" class="footer_link">{$_('nav.home')}</a></li>
					<li><a href="/movies" class="footer_link">{$_('nav.movies')}</a></li>
					<li>
						<a href="/cinemas" class="footer_link">{$_('nav.cinemas')}</a>
					</li>
				</ul>
			</div>

			<div class="footer_section">
				<h3 class="section_title">{$_('nav.movies')}</h3>
				<ul class="footer_links">
					<li>
						<a href="/movies" class="footer_link">{$_('movies.nowShowing')}</a>
					</li>
					<li>
						<a href="/movies" class="footer_link">{$_('movies.upcoming')}</a>
					</li>
				</ul>
			</div>

			<div class="footer_section footer_section--newsletter">
				<h3 class="section_title">{$_('footer.stayUpdated')}</h3>
				<p class="newsletter_description">
					{$_('footer.newsletterText')}
				</p>
				<div class="newsletter_form">
					<div class="newsletter_input_wrapper">
						<input
							bind:value={email}
							type="email"
							placeholder={$_('footer.emailPlaceholder')}
							class="newsletter_input"
							onkeydown={handleKeyDown}
						/>
						<button onclick={handleNewsletterSubmit} class="newsletter_btn">
							<Icon icon="lucide:send" width={16} />
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="footer_bottom">
			<div class="footer_bottom_content">
				<p class="copyright">
					&copy; {yearLabel} ZeroWaiting. {$_('footer.rights')}
				</p>
				<p class="author">
					<span>Built with</span>
					<Icon icon="lucide:heart" width={14} class="heart" />
					<span>by</span>
					<a
						href="https://elcho.dev/"
						target="_blank"
						rel="noopener noreferrer"
						class="author_link"
					>
						ElchoDev
					</a>
				</p>
			</div>
		</div>
	</div>
</footer>

<style lang="scss">
	.Footer {
		position: relative;
		border-top: 1px solid rgba(139, 92, 246, 0.1);
		overflow: hidden;
		margin-top: auto;

		.content {
			display: grid;
			grid-template-columns: 2fr 1fr 1fr 1.5fr;
			gap: 3rem;
			padding: 4rem 0 3rem;

			@media (max-width: 1024px) {
				grid-template-columns: 1fr 1fr;
				gap: 2rem;
			}

			@media (max-width: 768px) {
				grid-template-columns: 1fr 1fr;
				gap: 2rem 1.5rem;
				padding: 3rem 0 2rem;

				.footer_section--main,
				.footer_section--newsletter {
					grid-column: 1 / -1;
				}

				.footer_section--main {
					.footer_description {
						margin-bottom: 1.25rem;
						max-width: 28rem;
					}
				}
			}

			@media (max-width: 380px) {
				grid-template-columns: 1fr;
			}

			.footer_section {
				&--main {
					display: flex;
					flex-direction: column;
					align-items: flex-start;

					.logo {
						margin-bottom: 1.5rem;
						display: flex;
						align-items: center;
						gap: 0.75rem;
						text-decoration: none;
						color: white;
						font-weight: bold;
						font-size: 1.5rem;

						&:hover .logo_icon {
							transform: scale(1.1) rotate(5deg);
						}

						.logo_icon {
							width: 40px;
							height: 40px;
							background: linear-gradient(45deg, #8b5cf6, #a855f7);
							border-radius: 8px;
							display: flex;
							align-items: center;
							justify-content: center;
							color: white;
							box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
							transition: transform 0.3s ease;
						}

						.logo_text {
							background: linear-gradient(45deg, #ffffff, #c084fc);
							-webkit-background-clip: text;
							-webkit-text-fill-color: transparent;
							background-clip: text;
						}
					}

					.footer_description {
						color: rgba(255, 255, 255, 0.7);
						line-height: 1.6;
						margin-bottom: 2rem;
						font-size: 0.9rem;
					}

					.social_links {
						display: flex;
						gap: 1rem;

						.social_link {
							width: 40px;
							height: 40px;
							background: rgba(255, 255, 255, 0.08);
							border-radius: 50%;
							display: flex;
							align-items: center;
							justify-content: center;
							color: rgba(255, 255, 255, 0.7);
							transition: all 0.3s ease;
							backdrop-filter: blur(10px);
							border: 1px solid rgba(139, 92, 246, 0.2);

							&:hover {
								background: linear-gradient(45deg, #8b5cf6, #a855f7);
								color: white;
								transform: translateY(-2px) scale(1.1);
								box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
							}
						}
					}
				}

				&--newsletter {
					.newsletter_description {
						color: rgba(255, 255, 255, 0.7);
						font-size: 0.9rem;
						line-height: 1.5;
						margin-bottom: 1.5rem;
					}

					.newsletter_form {
						.newsletter_input_wrapper {
							position: relative;
							display: flex;
							align-items: center;

							.newsletter_input {
								width: 100%;
								padding: 0.75rem 3rem 0.75rem 1rem;
								background: rgba(255, 255, 255, 0.08);
								border: 1px solid rgba(139, 92, 246, 0.2);
								border-radius: 25px;
								color: white;
								font-size: 0.9rem;
								backdrop-filter: blur(10px);
								transition: all 0.3s ease;

								&::placeholder {
									color: rgba(255, 255, 255, 0.5);
								}

								&:focus {
									outline: none;
									border-color: #8b5cf6;
									background: rgba(255, 255, 255, 0.12);
									box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
								}
							}

							.newsletter_btn {
								position: absolute;
								right: 8px;
								background: linear-gradient(45deg, #8b5cf6, #a855f7);
								border: none;
								border-radius: 50%;
								width: 32px;
								height: 32px;
								display: flex;
								align-items: center;
								justify-content: center;
								color: white;
								cursor: pointer;
								transition: all 0.3s ease;

								&:hover {
									transform: scale(1.1);
									box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
								}
							}
						}
					}
				}

				.section_title {
					color: white;
					font-size: 1.1rem;
					font-weight: 600;
					margin-bottom: 1.5rem;
					position: relative;

					&::after {
						content: '';
						position: absolute;
						bottom: -0.5rem;
						left: 0;
						width: 2rem;
						height: 2px;
						background: linear-gradient(45deg, #8b5cf6, #a855f7);
					}
				}

				.footer_links {
					list-style: none;
					padding: 0;
					margin: 0;

					li {
						margin-bottom: 0.75rem;

						.footer_link {
							color: rgba(255, 255, 255, 0.7);
							text-decoration: none;
							font-size: 0.9rem;
							transition: all 0.3s ease;
							position: relative;
							display: inline-block;

							&::before {
								content: '';
								position: absolute;
								bottom: -2px;
								left: 0;
								width: 0;
								height: 1px;
								background: linear-gradient(45deg, #8b5cf6, #a855f7);
								transition: width 0.3s ease;
							}

							&:hover {
								color: white;
								transform: translateX(4px);

								&::before {
									width: 100%;
								}
							}
						}
					}
				}
			}
		}

		.footer_bottom {
			border-top: 1px solid rgba(139, 92, 246, 0.1);
			padding: 2rem 0;

			.footer_bottom_content {
				display: flex;
				justify-content: space-between;
				align-items: center;
				flex-wrap: wrap;
				gap: 12px 24px;

				@media (max-width: 768px) {
					justify-content: center;
					text-align: center;

					.author {
						order: 0;
					}

					.copyright {
						order: 1;
					}
				}

				.copyright {
					color: rgba(255, 255, 255, 0.6);
					font-size: 0.9rem;
					margin: 0;
				}

				.author {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					margin: 0;
					font-size: 0.9rem;
					color: rgba(255, 255, 255, 0.6);

					:global(.heart) {
						color: #ec4899;
						filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.55));
						animation: footerHeartbeat 1.6s ease-in-out infinite;
					}

					.author_link {
						font-weight: 600;
						text-decoration: none;
						background: linear-gradient(45deg, #ffffff, #c084fc);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;
						transition:
							opacity 0.2s ease,
							filter 0.2s ease;

						&:hover {
							opacity: 0.9;
							filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.45));
						}
					}
				}
			}

			@keyframes footerHeartbeat {
				0%,
				100% {
					transform: scale(1);
				}
				30% {
					transform: scale(1.2);
				}
				60% {
					transform: scale(0.95);
				}
			}
		}
	}
</style>
